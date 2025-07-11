// src/database/settingsRepository.ts
import type { Database, Statement } from 'better-sqlite3';
import {
    NotificationSettingsSchema,
    type NotificationSettings,
} from '../types/database';

type Persona = { name: string; description: string };
type Dialogue = { key: string; text: string };

export class SettingsRepository {
    private db: Database;
    private getSettingsStmt: Statement;
    private updateSettingsStmt: Statement;

    constructor(db: Database) {
        this.db = db;
        this.getSettingsStmt = this.db.prepare('SELECT * FROM notification_settings WHERE id = 1');
        this.updateSettingsStmt = this.db.prepare(`
            INSERT INTO notification_settings (
                id, notification_channel_id, timezone, reminder_enabled, reminder_time,
                report_enabled, report_frequency, report_time, last_reminder_sent_day, last_reminder_check_timestamp,
                active_persona_name
            )
            VALUES (
                1, @notification_channel_id, @timezone, @reminder_enabled, @reminder_time,
                @report_enabled, @report_frequency, @report_time, @last_reminder_sent_day, @last_reminder_check_timestamp,
                @active_persona_name
            )
            ON CONFLICT(id) DO UPDATE SET
                notification_channel_id = excluded.notification_channel_id,
                timezone = excluded.timezone,
                reminder_enabled = excluded.reminder_enabled,
                reminder_time = excluded.reminder_time,
                report_enabled = excluded.report_enabled,
                report_frequency = excluded.report_frequency,
                report_time = excluded.report_time,
                last_reminder_sent_day = excluded.last_reminder_sent_day,
                last_reminder_check_timestamp = excluded.last_reminder_check_timestamp,
                active_persona_name = excluded.active_persona_name
            RETURNING *
        `);
    }

    public getSettings(): NotificationSettings | null {
        const row = this.getSettingsStmt.get();
        if (!row) {
            return null;
        }
        return NotificationSettingsSchema.parse(row);
    }

    public updateSettings(partialSettings: Partial<NotificationSettings>): NotificationSettings {
        // Load existing settings (or defaults) first
        const current = this.getSettings();
        const defaults: NotificationSettings = {
            id: 1,
            notification_channel_id: null,
            timezone: 'UTC',
            reminder_enabled: false,
            reminder_time: null,
            report_enabled: false,
            report_frequency: null,
            report_time: null,
            last_reminder_sent_day: null,
            last_reminder_check_timestamp: null,
            active_persona_name: 'default',
        };

        // Merge the existing settings (or defaults) with the new partial data.
        const merged = { ...(current || defaults), ...partialSettings };

        // Map booleans to SQLite integers as needed.
        const dbData = {
            ...merged,
            reminder_enabled: merged.reminder_enabled ? 1 : 0,
            report_enabled: merged.report_enabled ? 1 : 0,
        };

        const result = this.updateSettingsStmt.get(dbData);
        return NotificationSettingsSchema.parse(result);
    }

    // --- Persona and Dialogue Methods ---

    public getAllPersonas(): Persona[] {
        return this.db.prepare('SELECT name, description FROM personas').all() as Persona[];
    }

    public getPersona(name: string): Persona | null {
        const row = this.db.prepare('SELECT name, description FROM personas WHERE name = ?').get(name);
        return (row as Persona) ?? null;
    }

    public getDialoguesForPersona(personaName: string): Dialogue[] {
        return this.db
            .prepare('SELECT key, text FROM dialogue WHERE persona_name = ?')
            .all(personaName) as Dialogue[];
    }
}