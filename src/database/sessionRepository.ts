// src/database/sessionRepository.ts
import type { Database, Statement } from 'bun:sqlite';
import type { PostConfidence } from '../types/session';

// This defines the structure of the session data we'll work with.
export interface SessionData {
    userId: string;
    channelId: string;
    messageId: string;
    mediaUrls: string[];
    detectedDays: number[];
    confidence: PostConfidence;
    expiresAt: number; // UNIX timestamp (seconds)
}

// This represents the raw row from the database.
interface SessionRow {
    user_id: string;
    channel_id: string;
    message_id: string;
    media_urls: string; // JSON string
    detected_days: string; // JSON string
    confidence: PostConfidence;
    expires_at: number;
}

export class SessionRepository {
    private db: Database;
    private getStmt: Statement;
    private getByMessageIdStmt: Statement;
    private upsertStmt: Statement;
    private deleteStmt: Statement;
    private findAllStmt: Statement;
    private deleteExpiredStmt: Statement;

    constructor(db: Database) {
        this.db = db;
        this.getStmt = this.db.prepare('SELECT * FROM archive_sessions WHERE user_id = ?');
        this.getByMessageIdStmt = this.db.prepare('SELECT * FROM archive_sessions WHERE message_id = ?');
        this.upsertStmt = this.db.prepare(
            `INSERT INTO archive_sessions (user_id, channel_id, message_id, media_urls, detected_days, confidence, expires_at)
             VALUES (@userId, @channelId, @messageId, @mediaUrls, @detectedDays, @confidence, @expiresAt)
             ON CONFLICT(user_id) DO UPDATE SET
                channel_id = excluded.channel_id,
                message_id = excluded.message_id,
                media_urls = excluded.media_urls,
                detected_days = excluded.detected_days,
                confidence = excluded.confidence,
                expires_at = excluded.expires_at`,
        );
        this.deleteStmt = this.db.prepare('DELETE FROM archive_sessions WHERE user_id = ?');
        this.findAllStmt = this.db.prepare('SELECT * FROM archive_sessions');
        this.deleteExpiredStmt = this.db.prepare('DELETE FROM archive_sessions WHERE expires_at < ?');
    }

    private rowToData(row: SessionRow): SessionData {
        return {
            userId: row.user_id,
            channelId: row.channel_id,
            messageId: row.message_id,
            mediaUrls: JSON.parse(row.media_urls) as string[],
            detectedDays: JSON.parse(row.detected_days) as number[],
            confidence: row.confidence,
            expiresAt: row.expires_at,
        };
    }

    public get(userId: string): SessionData | null {
        const row = this.getStmt.get(userId) as SessionRow | null;
        return row ? this.rowToData(row) : null;
    }

    public getByMessageId(messageId: string): SessionData | null {
        const row = this.getByMessageIdStmt.get(messageId) as SessionRow | null;
        return row ? this.rowToData(row) : null;
    }

    public findAll(): SessionData[] {
        const rows = this.findAllStmt.all() as SessionRow[];
        return rows.map(this.rowToData);
    }

    public upsert(data: SessionData): void {
        this.upsertStmt.run({
            userId: data.userId,
            channelId: data.channelId,
            messageId: data.messageId,
            mediaUrls: JSON.stringify(data.mediaUrls),
            detectedDays: JSON.stringify(data.detectedDays),
            confidence: data.confidence,
            expiresAt: data.expiresAt,
        });
    }

    public delete(userId: string): void {
        this.deleteStmt.run(userId);
    }
    
    public deleteExpired(): void {
        const now = Math.floor(Date.now() / 1000);
        this.deleteExpiredStmt.run(now);
    }
}