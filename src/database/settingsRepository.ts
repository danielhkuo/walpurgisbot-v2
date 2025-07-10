// src/database/settingsRepository.ts
import type { Database } from 'better-sqlite3';
import { NotificationSettingsSchema, type NotificationSettings } from '../types/database';

export class SettingsRepository {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    public getSettings(): NotificationSettings | null {
        const row = this.db.prepare('SELECT * FROM notification_settings WHERE id = 1').get();
        if (!row) {
            return null;
        }
        return NotificationSettingsSchema.parse(row);
    }
    
    // This uses an UPSERT operation: it inserts a new row if one doesn't exist,
    // or updates the existing one.
    public updateSettings(data: Partial<Omit<NotificationSettings, 'id'>>): NotificationSettings {
        const setClauses = Object.keys(data)
            .map(key => `${key} = @${key}`)
            .join(', ');

        const stmt = this.db.prepare(`
            INSERT INTO notification_settings (id, ${Object.keys(data).join(', ')})
            VALUES (1, ${Object.keys(data).map(k => `@${k}`).join(', ')})
            ON CONFLICT(id) DO UPDATE SET ${setClauses}
            RETURNING *
        `);

        // Convert boolean `true` to `1` and `false` to `0` for the database
        const dbData: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'boolean') {
                dbData[key] = value ? 1 : 0;
            } else {
                dbData[key] = value;
            }
        }
        
        const result = stmt.get(dbData);
        return NotificationSettingsSchema.parse(result);
    }
}