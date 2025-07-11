-- src/database/migrations/000_initial_schema.sql
-- Initial schema for the walpurgisbot-v2 database.
-- This migration creates all the core tables needed for the bot to function.
-- It is designed to be idempotent, so it can be run safely on new or existing databases.

-- The main table for storing archived posts.
CREATE TABLE IF NOT EXISTS posts (
    day INTEGER PRIMARY KEY,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    confirmed INTEGER NOT NULL DEFAULT 1
);

-- Stores media URLs associated with a post. One post can have many attachments.
CREATE TABLE IF NOT EXISTS media_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_day INTEGER NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY (post_day) REFERENCES posts(day) ON DELETE CASCADE
);

-- A temporary table to manage stateful interactions for archiving.
CREATE TABLE IF NOT EXISTS archive_sessions (
    user_id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    media_urls TEXT NOT NULL, -- JSON array of strings
    detected_days TEXT NOT NULL, -- JSON array of numbers
    confidence TEXT NOT NULL, -- 'high', 'low', 'none'
    expires_at INTEGER NOT NULL
);

-- Index to efficiently look up sessions by the message they are related to.
CREATE INDEX IF NOT EXISTS idx_sessions_message_id ON archive_sessions(message_id);

-- A singleton table (always id=1) for storing global bot settings.
CREATE TABLE IF NOT EXISTS notification_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    notification_channel_id TEXT,
    timezone TEXT,
    reminder_enabled INTEGER DEFAULT 0,
    reminder_time TEXT, -- e.g., '22:00'
    report_enabled INTEGER DEFAULT 0,
    report_frequency TEXT,
    report_time TEXT,
    last_reminder_sent_day INTEGER,
    last_reminder_check_timestamp INTEGER,
    CONSTRAINT id_must_be_1 CHECK (id = 1)
);

-- Initialize the settings row if it doesn't exist, so we can always UPDATE it.
INSERT OR IGNORE INTO notification_settings (id) VALUES (1);