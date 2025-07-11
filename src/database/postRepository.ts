// src/database/postRepository.ts
// Repository for handling all database operations related to posts
// and their media attachments.

import type { Database, Statement } from 'better-sqlite3';
import {
  PostSchema,
  MediaAttachmentSchema,
  MaxDaySchema,
  DayListSchema,
} from '../types/database';
import type { Post, MediaAttachment, CreatePostInput } from '../types/database';
import type { ImportPost } from '../types/import';
import logger from '../logger';

export class PostRepository {
  private db: Database;
  private createTransaction: (
    data: CreatePostInput,
  ) => { post: Post; media: MediaAttachment[] } | null;
  private importTransaction: (
    posts: ImportPost[],
  ) => { importedCount: number; skippedCount: number };

  // Statements
  private deleteByDayStmt: Statement;
  private deleteByMessageIdStmt: Statement;
  private findByDayStmt: Statement;
  private findMediaByDayStmt: Statement;
  private findByMessageIdStmt: Statement;
  private findAllWithMediaStmt: Statement;
  private maxDayStmt: Statement;
  private rangeStmt: Statement;
  private postInsertStmt: Statement;
  private mediaInsertStmt: Statement;

  constructor(db: Database) {
    this.db = db;

    // --- PREPARE STATEMENTS ---
    this.deleteByDayStmt = this.db.prepare('DELETE FROM posts WHERE day = ?');
    this.deleteByMessageIdStmt = this.db.prepare(
      'DELETE FROM posts WHERE message_id = ?',
    );
    this.findByDayStmt = this.db.prepare('SELECT * FROM posts WHERE day = ?');
    this.findMediaByDayStmt = this.db.prepare(
      'SELECT * FROM media_attachments WHERE post_day = ?',
    );
    this.findByMessageIdStmt = this.db.prepare(
      'SELECT * FROM posts WHERE message_id = ?',
    );
    this.maxDayStmt = this.db.prepare('SELECT MAX(day) as maxDay FROM posts');
    this.rangeStmt = this.db.prepare(
      'SELECT day FROM posts WHERE day BETWEEN ? AND ? ORDER BY day ASC',
    );
    this.postInsertStmt = this.db.prepare(
      'INSERT INTO posts (day, message_id, channel_id, user_id, timestamp, confirmed) VALUES (@day, @message_id, @channel_id, @user_id, @timestamp, 1)',
    );
    this.mediaInsertStmt = this.db.prepare(
      'INSERT INTO media_attachments (post_day, url) VALUES (?, ?)',
    );
    this.findAllWithMediaStmt = this.db.prepare(`
            SELECT
                p.day, p.message_id, p.channel_id, p.user_id, p.timestamp, p.confirmed,
                m.url AS media_url
            FROM posts p
            LEFT JOIN media_attachments m ON p.day = m.post_day
            ORDER BY p.day ASC
        `);

    // --- DEFINE TRANSACTIONS ---
    this.createTransaction = this.db.transaction((data: CreatePostInput) => {
      this.postInsertStmt.run({
        day: data.day,
        message_id: data.message_id,
        channel_id: data.channel_id,
        user_id: data.user_id,
        timestamp: data.timestamp,
      });

      for (const url of data.mediaUrls) {
        this.mediaInsertStmt.run(data.day, url);
      }
      return this.findByDay(data.day);
    });

    this.importTransaction = this.db.transaction((posts: ImportPost[]) => {
      let importedCount = 0;
      let skippedCount = 0;

      for (const post of posts) {
        // A. Check for existing data to prevent overwrites.
        const existing = this.findByDayStmt.get(post.day);
        if (existing) {
          skippedCount++;
          continue; // Skip this day, move to the next.
        }

        // B. Insert the main post record.
        this.postInsertStmt.run({
          day: post.day,
          message_id: post.message_id,
          channel_id: post.channel_id,
          user_id: post.user_id,
          timestamp: post.timestamp,
        });

        // --- START: CORRECTED LOGIC ---
        // C. Handle media transformation with improved type safety.
        let mediaUrls: string[];

        if ('media' in post && Array.isArray(post.media)) {
          // This is a V2 post object. The type is already string[].
          mediaUrls = post.media;
        } else {
          // This is a V1 post object. Collect and filter potential URLs.
          const potentialUrls = [
            'media_url1' in post ? post.media_url1 : undefined,
            'media_url2' in post ? post.media_url2 : undefined,
            'media_url3' in post ? post.media_url3 : undefined,
          ];
          // Use a type predicate function `(url): url is string` to filter out
          // any null or undefined values and inform TypeScript of the result.
          mediaUrls = potentialUrls.filter((url): url is string => !!url);
        }
        // --- END: CORRECTED LOGIC ---

        for (const url of mediaUrls) {
          this.mediaInsertStmt.run(post.day, url);
        }

        importedCount++;
      }

      return { importedCount, skippedCount };
    });
  }

  /**
   * Performs a bulk import of posts from a validated JSON object.
   * This entire operation is wrapped in a database transaction. If any part
   * fails, all changes are rolled back.
   *
   * @param posts An array of V1 or V2 post objects.
   * @returns An object reporting the count of imported and skipped posts.
   */
  public importFromJson(
    posts: ImportPost[],
  ): { importedCount: number; skippedCount: number } {
    return this.importTransaction(posts);
  }

  public createWithMedia(data: CreatePostInput) {
    return this.createTransaction(data);
  }

  public findByDay(day: number): { post: Post; media: MediaAttachment[] } | null {
    const postRow = this.findByDayStmt.get(day);
    if (!postRow) return null;

    const mediaRows = this.findMediaByDayStmt.all(day);

    try {
      const post = PostSchema.parse(postRow);
      const media = MediaAttachmentSchema.array().parse(mediaRows);
      return { post, media };
    } catch (error) {
      logger.error({ err: error, day }, 'Database data failed validation for day.');
      return null;
    }
  }

  public findPostsByMessageId(messageId: string): Post[] {
    const rows = this.findByMessageIdStmt.all(messageId);
    try {
      return PostSchema.array().parse(rows);
    } catch (error) {
      logger.error(
        { err: error, messageId },
        'Database data failed validation for messageId query.',
      );
      return [];
    }
  }

  public findAllWithMedia(): (Post & { media: string[] })[] {
    const rows = this.findAllWithMediaStmt.all() as (Post & {
      media_url: string | null;
    })[];
    const postsMap = new Map<number, Post & { media: string[] }>();

    for (const row of rows) {
      // Check if we've already processed this post
      if (!postsMap.has(row.day)) {
        try {
          // Parse the post data once and store it
          const post = PostSchema.parse(row);
          postsMap.set(row.day, { ...post, media: [] });
        } catch (error) {
          logger.error(
            { err: error, row },
            'Invalid post data during export, skipping.',
          );
          continue; // Skip this malformed post row
        }
      }

      // Add media URL if it exists
      const postEntry = postsMap.get(row.day);
      if (postEntry && row.media_url) {
        postEntry.media.push(row.media_url);
      }
    }

    // Return an array of the structured post objects
    return Array.from(postsMap.values());
  }

  public deleteByDay(day: number): boolean {
    const info = this.deleteByDayStmt.run(day);
    return info.changes > 0;
  }

  public deleteByMessageId(messageId: string): boolean {
    const info = this.deleteByMessageIdStmt.run(messageId);
    return info.changes > 0;
  }

  public getMaxDay(): number | null {
    const row = this.maxDayStmt.get();
    return MaxDaySchema.parse(row).maxDay;
  }

  public getArchivedDaysInRange(start: number, end: number): number[] {
    const rows = this.rangeStmt.all(start, end);
    return DayListSchema.parse(rows).map(row => row.day);
  }
}