-- Migration 001: Add notification_settings table
-- This table will store all user-configurable, proactive settings.
CREATE TABLE notification_settings (
    -- Using a static ID since we expect only one row for this single-guild bot.
    -- This makes queries simpler than using guild_id.
    id INTEGER PRIMARY KEY CHECK (id = 1),
    
    notification_channel_id TEXT,
    timezone TEXT,

    reminder_enabled INTEGER NOT NULL DEFAULT 0, -- 0 for false, 1 for true
    -- Stored in 'HH:MM' 24-hour format
    reminder_time TEXT,

    report_enabled INTEGER NOT NULL DEFAULT 0,
    -- e.g., 'daily', 'weekly'
    report_frequency TEXT,
    -- Stored in 'HH:MM' 24-hour format
    report_time TEXT,
    
    last_reminder_sent_day INTEGER -- Stores the last day number for which a reminder was sent
);