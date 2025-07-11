-- src/database/migrations/000_initial_schema.sql
-- Initial schema for the walpurgisbot-v2 database.
-- This migration creates all the core tables needed for the bot to function.
-- It is designed to be idempotent, so it can be run safely on new or existing databases.

-- Archive posts and their associated media.
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER NOT NULL UNIQUE, -- Day number from archive (e.g., 123)
    channel_id TEXT NOT NULL,   -- Discord channel ID
    message_id TEXT NOT NULL,   -- Discord message ID
    timestamp INTEGER NOT NULL  -- Unix timestamp when the post was archived
);

-- Individual media attachments belonging to a post.
CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_day INTEGER NOT NULL, -- Reference to posts.day (cascading deletes)
    url TEXT NOT NULL,
    FOREIGN KEY (post_day) REFERENCES posts(day) ON DELETE CASCADE
);

-- Sessions to track user interactions for archive processing.
CREATE TABLE IF NOT EXISTS archive_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    message_id TEXT NOT NULL UNIQUE,
    channel_id TEXT NOT NULL,
    detected_days TEXT, -- JSON array of detected day numbers
    confidence_level TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- Index to efficiently look up sessions by the message they are related to.
CREATE INDEX IF NOT EXISTS idx_sessions_message_id ON archive_sessions(message_id);

-- Stores the available personas for the bot.
CREATE TABLE IF NOT EXISTS personas (
    name TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

-- Stores all user-facing dialogue strings, keyed for retrieval.
CREATE TABLE IF NOT EXISTS dialogue (
    key TEXT NOT NULL,
    persona_name TEXT NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (key, persona_name),
    FOREIGN KEY (persona_name) REFERENCES personas(name) ON DELETE CASCADE
);

-- A singleton table (always id=1) for storing global bot settings.
CREATE TABLE IF NOT EXISTS notification_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    notification_channel_id TEXT,
    timezone TEXT DEFAULT 'UTC',
    reminder_enabled BOOLEAN DEFAULT FALSE,
    reminder_time TEXT,
    report_enabled BOOLEAN DEFAULT FALSE,
    report_frequency TEXT,
    report_time TEXT,
    last_reminder_sent_day INTEGER,
    last_reminder_check_timestamp INTEGER,
    active_persona_name TEXT NOT NULL DEFAULT 'default',
    CONSTRAINT id_must_be_1 CHECK (id = 1),
    FOREIGN KEY (active_persona_name) REFERENCES personas(name) ON UPDATE CASCADE
);

-- Initialize the settings row if it doesn't exist, so we can always UPDATE it.
INSERT OR IGNORE INTO notification_settings (id, active_persona_name) VALUES (1, 'default');

-- Populate the default persona and its dialogue strings.
INSERT OR IGNORE INTO personas (name, description) VALUES ('default', 'The standard, helpful Walpurgis bot.');

INSERT OR IGNORE INTO dialogue (key, persona_name, text) VALUES
-- Generic Errors
('error.generic', 'default', 'An unexpected error occurred. Please check the logs.'),
('error.generic.tryAgain', 'default', 'An error occurred. Try again.'),
('error.noPermission', 'default', 'You do not have permission to perform this action.'),
('error.command.notFound', 'default', 'No command matching `/{commandName}` was found.'),
('error.command.execution', 'default', 'There was an error while executing this command!'),
('error.export.generic', 'default', 'An unexpected error occurred while generating the export. Please check the logs.'),

-- Export Command
('export.desc', 'default', 'Exports the entire archive database to a JSON file.'),
('export.generating', 'default', '⏳ Generating database export... this may take a moment.'),
('export.empty', 'default', 'ℹ️ The archive is empty. Nothing to export.'),
('export.fail.tooLarge', 'default', '❌ **Export Failed:** The database is too large to send as a single file via Discord (over 24MB). Please contact the bot developer for a manual export.'),
('export.dm.content', 'default', 'Here is your database export:'),
('export.success.dm', 'default', '✅ The database export has been sent to your DMs.'),
('export.fail.dm', 'default', '❌ **Could not send DM.** Please check your privacy settings to allow DMs from this server, then try again.'),

-- Import Command
('import.desc', 'default', 'Imports posts from a V1 or V2 JSON export file.'),
('import.option.attachment.desc', 'default', 'The JSON export file to import.'),
('import.processing', 'default', '⏳ Validating and processing your import file...'),
('import.fail.notJson', 'default', '❌ **Import Failed:** Please provide a valid JSON file (`.json`).'),
('import.fail.tooLarge', 'default', '❌ **Import Failed:** The file is too large (over 24MB).'),
('import.fail.parse', 'default', '❌ **Import Failed:** Could not download or parse the file. Ensure it is valid JSON.'),
('import.success', 'default', '✅ **Import Complete!**\n- **Posts Imported:** `{importedCount}`\n- **Posts Skipped (Already Existed):** `{skippedCount}`\n- **Total Posts Processed:** `{total}`'),
('import.fail.invalidFormat', 'default', '❌ **Invalid File Format:** The file is not a valid export.\n**Error:** At entry `{path}`: {message}'),
('import.fail.database', 'default', '❌ **Import Failed:** An unexpected error occurred while writing to the database. The database has not been changed. Please check the logs.'),

-- Settings Command
('settings.desc', 'default', 'Configure bot settings for this server.'),
('settings.channel.desc', 'default', 'Sets the channel for bot notifications (reminders, reports).'),
('settings.channel.option.desc', 'default', 'The text channel to send notifications to.'),
('settings.channel.fail.internal', 'default', 'An internal error occurred. Could not verify my own permissions.'),
('settings.channel.fail.perms', 'default', '❌ I need **View Channel** and **Send Messages** permissions in {channel} to send notifications.'),
('settings.channel.success', 'default', '✅ Success! Bot notifications will now be sent to {channel}.'),
('settings.channel.fail.save', 'default', 'An error occurred while saving the channel setting. Please try again.'),
('settings.timezone.desc', 'default', 'Sets the bot''s timezone for scheduling.'),
('settings.timezone.option.desc', 'default', 'The IANA timezone identifier (e.g., Europe/London).'),
('settings.timezone.fail.invalid', 'default', '❌ Invalid timezone `{timezone}`. Please select a valid IANA timezone from the list.'),
('settings.timezone.success', 'default', '✅ Success! The bot''s timezone has been set to `{timezone}`.'),
('settings.timezone.fail.save', 'default', 'An error occurred while saving the timezone setting. Please try again.'),
('settings.reminder.desc', 'default', 'Configures the daily missing archive reminder.'),
('settings.reminder.option.status.desc', 'default', 'Enable or disable the daily reminder.'),
('settings.reminder.option.time.desc', 'default', 'The time to send the reminder (24h HH:MM format). Required if enabling.'),
('settings.reminder.fail.noTime', 'default', '❌ `time` is required when enabling.'),
('settings.reminder.fail.invalidTime', 'default', '❌ Time must be HH:MM (24-h).'),
('settings.reminder.enable.success', 'default', '✅ Daily reminders **enabled** at `{time}`.'),
('settings.reminder.disable.success', 'default', '✅ Daily reminders **disabled**.'),
('settings.persona.desc', 'default', 'Manages the bot''s persona (dialogue style).'),
('settings.persona.set.desc', 'default', 'Sets the active persona for the bot.'),
('settings.persona.set.option.name.desc', 'default', 'The name of the persona to activate.'),
('settings.persona.list.desc', 'default', 'Lists all available personas.'),
('settings.persona.set.success', 'default', '✅ Persona set to `{name}`. Dialogue has been reloaded.'),
('settings.persona.set.fail.notFound', 'default', '❌ Persona `{name}` not found. Use `/settings persona list` to see available personas.'),
('settings.persona.set.fail.generic', 'default', 'An error occurred while setting the persona.'),
('settings.persona.list.title', 'default', 'Available Personas:'),
('settings.persona.list.activeSuffix', 'default', ' (Active)'),
('settings.persona.list.empty', 'default', 'No personas found in the database.'),
('settings.persona.list.fail.generic', 'default', 'An error occurred while listing personas.'),

-- Context Menu Commands
('context.archive.name', 'default', 'Manual Archive Post'),
('context.delete.name', 'default', 'Delete Archive Entry'),
('context.delete.fail.notRegistered', 'default', 'This message is not registered as an archive entry.'),

-- Delete Command
('delete.desc', 'default', 'Deletes an archive entry after confirmation.'),
('delete.day.desc', 'default', 'Deletes a specific day''s archive using its number.'),
('delete.day.option.day.desc', 'default', 'The day number to delete.'),
('delete.link.desc', 'default', 'Deletes an archive entry using the original message link.'),
('delete.link.option.message_link.desc', 'default', 'A link to the Discord message to delete from the archive.'),
('delete.day.fail.notFound', 'default', 'Error: No archive found for Day {day}.'),
('delete.link.fail.invalid', 'default', '❌ Invalid message link format. Please provide a valid Discord message link.'),
('delete.link.fail.notFound', 'default', 'No archive entry is associated with that message.'),

-- Manual Archive Command
('manualArchive.desc', 'default', 'Manually archives a post using its message ID.'),
('manualArchive.option.message_id.desc', 'default', 'The ID of the message to archive.'),
('manualArchive.fail.noChannel', 'default', 'This command must be run in a channel.'),
('manualArchive.fail.notFound', 'default', 'Error: Could not find a message with that ID in this channel.'),

-- Search Command
('search.desc', 'default', 'Retrieves a specific day''s archive.'),
('search.option.day.desc', 'default', 'The day number to search for.'),
('search.fail.notFound', 'default', 'No archive found for Day {day}.'),
('search.embed.title', 'default', 'Archive for Day {day}'),
('search.embed.description', 'default', 'Archived on <t:{timestamp}:f>.\n[Jump to Original Message]({jumpUrl})'),
('search.embed.field.additionalMedia', 'default', 'Additional Media'),
('search.embed.field.more', 'default', ' | and {remaining} more...'),

-- Status Command
('status.desc', 'default', 'Shows which days in a range are archived or missing.'),
('status.option.start.desc', 'default', 'The starting day number.'),
('status.option.end.desc', 'default', 'The ending day number.'),
('status.fail.startAfterEnd', 'default', 'Error: The start day must be less than or equal to the end day.'),
('status.embed.noData', 'default', 'No data for this page.'),
('status.embed.title', 'default', 'Archive Status: Days {start} - {end}'),
('status.embed.footer', 'default', 'Page {page} of {totalPages}'),
('status.embed.dayStatus', 'default', 'Day {day}: {status}'),

-- Delete Confirmation Helper
('delete.confirm.button.confirm', 'default', 'Yes, Delete'),
('delete.confirm.button.cancel', 'default', 'No, Cancel'),
('delete.confirm.prompt', 'default', 'This message is associated with Day(s) **{days}**. Are you sure you want to delete all related archive entries?'),
('delete.confirm.success', 'default', '✅ Deletion confirmed. The archive entries for Day(s) **{days}** have been removed.'),
('delete.confirm.fail', 'default', '❌ Error: Failed to delete the archive entries. Check the logs.'),
('delete.confirm.cancelled', 'default', 'Deletion cancelled.'),
('delete.confirm.timeout', 'default', 'Confirmation timed out. Deletion cancelled.'),

-- Manual Archive Helper
('manualArchive.modal.fail.noAttachments', 'default', 'Error: The selected message has no attachments to archive.'),
('manualArchive.modal.title', 'default', 'Manual Archive'),
('manualArchive.modal.day.label', 'default', 'Day Number'),
('manualArchive.modal.day.placeholder', 'default', 'e.g., 123'),
('manualArchive.reply.fail.invalidDay', 'default', 'Error: Please provide a valid, positive day number.'),
('manualArchive.reply.fail.exists', 'default', 'Error: An archive for Day {day} already exists.'),
('manualArchive.reply.success', 'default', '✅ Successfully created an archive for Day {day}.'),
('manualArchive.reply.fail.generic', 'default', 'An error occurred while creating the archive. Please check the logs.'),

-- Archive Session Manager
('session.alert.sequence', 'default', '⚠️ **Sequence Alert:** I expected Day `{expectedDay}`, but this post says Day `{day}`. How should I proceed? ([Original Message]({url}))'),
('session.button.forceArchive', 'default', 'Force Archive as Day {day}'),
('session.button.ignorePost', 'default', 'Ignore This Post'),
('session.alert.ambiguous', 'default', '⚠️ **Manual Action Required:** I detected multiple days ({days}) in a single message. To prevent data errors, please use `/manual-archive` for each day, using message ID `{messageId}`. ([Original Message]({url}))'),
('session.alert.lowConfidence', 'default', '🤔 **Possible Archive Detected:** I found the number `{day}` in this message, but the format was unclear. Do you want to archive this as Day {day}? ([Original Message]({url}))'),
('session.button.confirmArchive', 'default', 'Confirm Archive as Day {day}'),
('session.button.ignore', 'default', 'Ignore'),
('session.alert.mediaOnly', 'default', 'I saw a new photo from Johan with no day information. Is this a Daily Johan archive? ([Original Message]({url}))'),
('session.button.addDayInfo', 'default', 'Yes, Add Day Info'),
('session.button.notArchive', 'default', 'No, Not an Archive'),
('session.reply.fail.noMessage', 'default', 'Error: Could not find the original message to archive.'),
('session.reply.archiveSuccess', 'default', '✅ Action Confirmed. Post has been archived as Day {day}.'),
('session.modal.addDay.title', 'default', 'Add Day Info to Archive'),
('session.modal.addDay.label', 'default', 'What day number should this be?'),
('session.reply.ignored', 'default', 'OK, this post will be ignored.'),
('session.reply.fail.invalidDay', 'default', 'Error: Invalid day number.'),
('session.reply.fail.exists', 'default', 'Error: Day {day} already exists in the archive.'),
('session.reply.manualSuccess', 'default', '✅ Success! Post has been archived as Day {day}.'),

-- Notification Service
('notification.reminder.missingDay', 'default', '🗓️ **Reminder:** The latest archive is Day `{maxDay}`. A post for Day `{expectedDay}` might be missing!');