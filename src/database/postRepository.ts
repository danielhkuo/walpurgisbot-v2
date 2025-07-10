// src/database/postRepository.ts
import type { Database, Statement } from 'better-sqlite3';
import { PostSchema, MediaAttachmentSchema, MaxDaySchema, DayListSchema } from '../types/database';
import type { Post, MediaAttachment, CreatePostInput } from '../types/database';
import logger from '../logger';

export class PostRepository {
    private db: Database;
    private createTransaction: (data: CreatePostInput) => { post: Post; media: MediaAttachment[] } | null;
    private deleteStatement: Statement;
    private findByDayStatement: Statement;
    private findMediaByDayStatement: Statement;
    private maxDayStatement: Statement;
    private rangeStatement: Statement;
    private postInsertStmt: Statement;
    private mediaInsertStmt: Statement;

    constructor(db: Database) {
        this.db = db;

        // --- PREPARE STATEMENTS ---
        this.deleteStatement = this.db.prepare('DELETE FROM posts WHERE day = ?');
        this.findByDayStatement = this.db.prepare('SELECT * FROM posts WHERE day = ?');
        this.findMediaByDayStatement = this.db.prepare('SELECT * FROM media_attachments WHERE post_day = ?');
        this.maxDayStatement = this.db.prepare('SELECT MAX(day) as maxDay FROM posts');
        this.rangeStatement = this.db.prepare('SELECT day FROM posts WHERE day BETWEEN ? AND ? ORDER BY day ASC');
        this.postInsertStmt = this.db.prepare(
            'INSERT INTO posts (day, message_id, channel_id, user_id, timestamp, confirmed) VALUES (@day, @message_id, @channel_id, @user_id, @timestamp, 1)',
        );
        this.mediaInsertStmt = this.db.prepare(
            'INSERT INTO media_attachments (post_day, url) VALUES (?, ?)',
        );

        // --- DEFINE TRANSACTION ---
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
    }

    public createWithMedia(data: CreatePostInput) {
        return this.createTransaction(data);
    }

    public findByDay(day: number): { post: Post; media: MediaAttachment[] } | null {
        const postRow = this.findByDayStatement.get(day);
        if (!postRow) return null;

        const mediaRows = this.findMediaByDayStatement.all(day);

        try {
            const post = PostSchema.parse(postRow);
            const media = MediaAttachmentSchema.array().parse(mediaRows);
            return { post, media };
        } catch (error) {
            logger.error({ err: error, day }, 'Database data failed validation for day.');
            return null;
        }
    }

    public deleteByDay(day: number): boolean {
        const info = this.deleteStatement.run(day);
        // ON DELETE CASCADE handles the media_attachments table automatically.
        return info.changes > 0;
    }

    public getMaxDay(): number | null {
        const row = this.maxDayStatement.get();
        return MaxDaySchema.parse(row).maxDay;
    }

    public getArchivedDaysInRange(start: number, end: number): number[] {
        const rows = this.rangeStatement.all(start, end);
        return DayListSchema.parse(rows).map(row => row.day);
    }
}