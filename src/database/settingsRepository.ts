// src/database/settingsRepository.ts
import type { Database, Statement } from 'better-sqlite3';
import { NotificationSettingsSchema, type NotificationSettings } from '../types/database';

export class SettingsRepository {
    private db: Database;
    private updateSettingsStmt: Statement;

    constructor(db: Database) {
        this.db = db;

        // This static query lists all columns explicitly for safety and clarity.
        // It performs an "UPSERT": INSERT or, on conflict (id=1 exists), UPDATE.
        // The `excluded.` prefix in the UPDATE clause refers to the values that
        // would have been inserted, ensuring the latest data is always used.
        this.updateSettingsStmt = this.db.prepare(`
            INSERT INTO notification_settings (
                id, notification_channel_id, timezone, reminder_enabled, reminder_time,
                report_enabled, report_frequency, report_time, last_reminder_sent_day,
                last_reminder_check_timestamp
            )
            VALUES (
                1, @notification_channel_id, @timezone, @reminder_enabled, @reminder_time,
                @report_enabled, @report_frequency, @report_time, @last_reminder_sent_day,
                @last_reminder_check_timestamp
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
                last_reminder_check_timestamp = excluded.last_reminder_check_timestamp
            RETURNING *
        `);
    }

    public getSettings(): NotificationSettings | null {
        const row = this.db.prepare('SELECT * FROM notification_settings WHERE id = 1').get();
        if (!row) {
            return null;
        }
        return NotificationSettingsSchema.parse(row);
    }
    
    public updateSettings(data: Partial<Omit<NotificationSettings, 'id'>>): NotificationSettings {
        const currentSettings = this.getSettings();

        // Define the complete structure of a settings object with defaults.
        // This is crucial for the static query, which requires all parameters.
        const defaults = {
            notification_channel_id: null,
            timezone: null,
            reminder_enabled: false,
            reminder_time: null,
            report_enabled: false,
            report_frequency: null,
            report_time: null,
            last_reminder_sent_day: null,
            last_reminder_check_timestamp: null,
        };

        // Merge the existing settings (or defaults) with the new partial data.
        const completeData = { ...(currentSettings ?? defaults), ...data };
        
        // Convert boolean values to integers (1/0) for the database.
        const dbData = {
            ...completeData,
            reminder_enabled: completeData.reminder_enabled ? 1 : 0,
            report_enabled: completeData.report_enabled ? 1 : 0,
        };

        const result = this.updateSettingsStmt.get(dbData);
        return NotificationSettingsSchema.parse(result);
    }
}