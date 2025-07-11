// src/database/settingsRepository.ts
import type { Database, Statement } from 'bun:sqlite';
import logger from '../logger'; // Import the logger directly for debugging
import {
    NotificationSettingsSchema,
    type NotificationSettings,
} from '../types/database';

type Persona = { name: string; description: string };
type Dialogue = { key: string; text: string };

export class SettingsRepository {
    private db: Database;
    private getSettingsStmt: Statement;
    private upsertSettingsStmt: Statement;

    constructor(db: Database) {
        this.db = db;
        this.getSettingsStmt = this.db.prepare('SELECT * FROM notification_settings WHERE id = 1') as Statement;
        
        this.upsertSettingsStmt = this.db.prepare(`
            INSERT INTO notification_settings (
                id, notification_channel_id, timezone, reminder_enabled, reminder_time,
                report_enabled, report_frequency, report_time, last_reminder_sent_day, last_reminder_check_timestamp,
                active_persona_name
            )
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        `) as Statement;
    }

    public getSettings(): NotificationSettings | null {
        logger.debug('[SettingsRepo] Getting settings from DB...');
        const row = this.getSettingsStmt.get() as NotificationSettings | null;
        if (!row) {
            logger.warn('[SettingsRepo] No settings row found in DB.');
            return null;
        }
        logger.debug({ settingsRowFromDb: row }, '[SettingsRepo] Raw settings row received from DB.');
        
        try {
            const parsed = NotificationSettingsSchema.parse(row);
            logger.debug({ parsedSettings: parsed }, '[SettingsRepo] Successfully parsed settings object.');
            return parsed;
        } catch(e) {
            logger.error({ zodError: e, rawRow: row }, '[SettingsRepo] ZOD PARSING FAILED for settings row!');
            return null; // Return null on parse failure
        }
    }

    public updateSettings(partialSettings: Partial<NotificationSettings>): NotificationSettings {
        logger.debug({ partialSettings }, '[SettingsRepo] updateSettings called with partial data.');

        const currentSettings = this.getSettings();
        if (!currentSettings) {
            logger.error('[SettingsRepo] CRITICAL: Cannot update because getSettings() returned null. Aborting update.');
            throw new Error('Failed to update settings: The settings row (id=1) was not found or failed to parse. This indicates a migration issue. Please delete the database file and restart the bot.');
        }
        logger.debug({ currentSettings }, '[SettingsRepo] Current settings object before merge.');

        const newSettings: NotificationSettings = {
            ...currentSettings,
            ...partialSettings,
        };
        logger.debug({ newSettings }, '[SettingsRepo] Settings object after merging partial data.');

        const dbPayload = {
            ...newSettings,
            reminder_enabled: newSettings.reminder_enabled ? 1 : 0,
            report_enabled: newSettings.report_enabled ? 1 : 0,
        };
        logger.debug({ dbPayload }, '[SettingsRepo] Final payload being sent to the database.');

        try {
            // Use positional parameters in the correct order
            const result = this.upsertSettingsStmt.get(
                dbPayload.notification_channel_id,
                dbPayload.timezone,
                dbPayload.reminder_enabled,
                dbPayload.reminder_time,
                dbPayload.report_enabled,
                dbPayload.report_frequency,
                dbPayload.report_time,
                dbPayload.last_reminder_sent_day,
                dbPayload.last_reminder_check_timestamp,
                dbPayload.active_persona_name
            );
            if (!result) {
                logger.error({ dbPayload }, '[SettingsRepo] CRITICAL: Database upsert returned no result. The update failed.');
                throw new Error('Database update failed to return the updated row.');
            }
            logger.debug({ resultFromDb: result }, '[SettingsRepo] Raw result returned from DB after update.');

            const finalParsed = NotificationSettingsSchema.parse(result);
            logger.info('[SettingsRepo] Successfully updated and parsed settings.');
            return finalParsed;
        } catch (error) {
            logger.error({ err: error, payload: dbPayload }, '[SettingsRepo] CRITICAL: Error thrown during database upsert operation.');
            throw error; // Re-throw the original error
        }
    }

    // --- Persona and Dialogue Methods (Unchanged) ---

    public getAllPersonas(): Persona[] {
        const stmt = this.db.prepare('SELECT name, description FROM personas');
        return stmt.all() as Persona[];
    }

    public getPersona(name: string): Persona | null {
        const stmt = this.db.prepare('SELECT name, description FROM personas WHERE name = ?');
        const row = stmt.get(name) as Persona | undefined;
        return row ?? null;
    }

    public getDialoguesForPersona(personaName: string): Dialogue[] {
        const stmt = this.db.prepare('SELECT key, text FROM dialogue WHERE persona_name = ?');
        return stmt.all(personaName) as Dialogue[];
    }
}