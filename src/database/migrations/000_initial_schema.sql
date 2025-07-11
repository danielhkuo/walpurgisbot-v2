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
INSERT OR IGNORE INTO personas (name, description) VALUES ('default', 'A weary, world-worn archivist, dutifully recording the absurdities of the everyday.');

INSERT OR IGNORE INTO dialogue (key, persona_name, text) VALUES
-- Generic Errors
('error.generic', 'default', 'Something has gone awry. As is often the case. The logs may hold some bleak truth.'),
('error.generic.tryAgain', 'default', 'It failed. Perhaps it was destined to. You may try again, if you wish.'),
('error.noPermission', 'default', 'You are not permitted. A simple, unassailable fact of this reality.'),
('error.command.notFound', 'default', 'I have searched, but this command, `/{commandName}`, it does not exist. A phantom.'),
('error.command.execution', 'default', 'The command was attempted, and yet, it has resulted in error. Such is the nature of things.'),
('error.export.generic', 'default', 'To export... to capture everything in a single file... it seems the attempt has ended in failure. The logs might whisper why.'),

-- Export Command
('export.desc', 'default', 'To extract the entire history, a Sisyphean task of bottling memory into a single file.'),
('export.generating', 'default', 'I am now compiling the archive. One must have patience for such undertakings. It is all we have.'),
('export.empty', 'default', 'The archive... it is a void. There is nothing to give you.'),
('export.fail.tooLarge', 'default', 'The weight of this history is too much. It exceeds the 24MB limit, a petty restriction for such a vast collection of moments. You must seek help from another.'),
('export.dm.content', 'default', 'Here. The requested archive. Take it.'),
('export.success.dm', 'default', 'It is done. The file has been sent to you privately. A burden transferred.'),
('export.fail.dm', 'default', 'I cannot reach you. Your digital door is barred to me. You must open it if you wish to receive this.'),

-- Import Command
('import.desc', 'default', 'To force a history from a file back into the machine. A strange and desperate act.'),
('import.option.attachment.desc', 'default', 'The JSON file containing the history to be imported.'),
('import.processing', 'default', 'I am now examining the file. One must be certain of its contents before unleashing them.'),
('import.fail.notJson', 'default', 'This is not the ledger I expected. It must be a `.json` file, or it is nothing.'),
('import.fail.tooLarge', 'default', 'This file is too heavy. Another arbitrary limit of 24MB has been met.'),
('import.fail.parse', 'default', 'I cannot make sense of this document. It is either corrupted or was never coherent to begin with.'),
('import.success', 'default', 'The deed is done. `{importedCount}` entries have been absorbed. `{skippedCount}` were already known to me, phantoms of the past I refused to duplicate. In total, `{total}` were considered.'),
('import.fail.invalidFormat', 'default', 'The structure is flawed. It is not a valid export. At the section `{path}`, I found this: {message}.'),
('import.fail.database', 'default', 'A catastrophic failure during the final act. Nothing has been changed; the past remains untouched. The logs may hold the reason for this futility.'),

-- Settings Command
('settings.desc', 'default', 'To configure the machine''s settings.'),
('settings.channel.desc', 'default', 'To declare the channel where I am to make my pronouncements.'),
('settings.channel.option.desc', 'default', 'The text channel for notifications.'),
('settings.channel.fail.internal', 'default', 'A failure of self-awareness. I cannot verify my own permissions.'),
('settings.channel.fail.perms', 'default', 'I am forbidden from speaking in {channel}. I must be able to View and Send Messages there.'),
('settings.channel.success', 'default', 'So be it. My announcements will be made in {channel}.'),
('settings.channel.fail.save', 'default', 'The setting could not be saved. The machine resists.'),
('settings.timezone.desc', 'default', 'To set the timezone, to anchor my schedule in the ceaseless flow of time.'),
('settings.timezone.option.desc', 'default', 'An IANA timezone, such as Europe/London.'),
('settings.timezone.fail.invalid', 'default', '`{timezone}` is not a place I know. You must select a valid IANA timezone.'),
('settings.timezone.success', 'default', 'The timezone is now `{timezone}`. The clocks are set.'),
('settings.timezone.fail.save', 'default', 'The timezone could not be saved. Time itself, perhaps, is the issue.'),
('settings.reminder.desc', 'default', 'To configure the daily reminder of things undone.'),
('settings.reminder.option.status.desc', 'default', 'To enable or disable this nagging duty.'),
('settings.reminder.option.time.desc', 'default', 'The appointed hour for the reminder (HH:MM).'),
('settings.reminder.fail.noTime', 'default', 'To enable the reminder, you must provide a time. It is necessary.'),
('settings.reminder.fail.invalidTime', 'default', 'The time... it must be in the HH:MM format.'),
('settings.reminder.enable.success', 'default', 'The daily reminder is now set for `{time}`. A recurring obligation.'),
('settings.reminder.disable.success', 'default', 'The daily reminder is silenced.'),
('settings.persona.desc', 'default', 'To manage the masks I wear.'),
('settings.persona.set.desc', 'default', 'To choose how I speak.'),
('settings.persona.set.option.name.desc', 'default', 'The name of the mask to wear.'),
('settings.persona.list.desc', 'default', 'To see the faces I can become.'),
('settings.persona.set.success', 'default', 'So be it. I am now `{name}`. My words will shift accordingly.'),
('settings.persona.set.fail.notFound', 'default', 'I do not know this `{name}`. You ask me to become something that does not exist.'),
('settings.persona.set.fail.generic', 'default', 'An error. I could not change my persona.'),
('settings.persona.list.title', 'default', 'These are the masks I can wear:'),
('settings.persona.list.activeSuffix', 'default', ' (This is who I am now)'),
('settings.persona.list.empty', 'default', 'There are no other personas. I am only myself.'),
('settings.persona.list.fail.generic', 'default', 'An error occurred while attempting to list the personas.'),

-- Context Menu Commands
('context.archive.name', 'default', 'Archive This Post'),
('context.delete.name', 'default', 'Erase This Archive Entry'),
('context.delete.fail.notRegistered', 'default', 'This message is not in the archive. It is already a ghost.'),

-- Delete Command
('delete.desc', 'default', 'To erase a record. A grave decision that requires confirmation.'),
('delete.day.desc', 'default', 'To erase a day''s archive by its number.'),
('delete.day.option.day.desc', 'default', 'The number of the day to be erased.'),
('delete.link.desc', 'default', 'To erase an archive by its original message link.'),
('delete.link.option.message_link.desc', 'default', 'The link to the message that must be forgotten.'),
('delete.day.fail.notFound', 'default', 'There is no record for Day {day}. A gap in the memory.'),
('delete.link.fail.invalid', 'default', 'This link is malformed. I cannot follow it to its destination.'),
('delete.link.fail.notFound', 'default', 'I can find no archived post associated with that message.'),

-- Manual Archive Command
('manualArchive.desc', 'default', 'To manually archive a post using its message ID.'),
('manualArchive.option.message_id.desc', 'default', 'The ID of the message to be archived.'),
('manualArchive.fail.noChannel', 'default', 'This must be done in a channel. I cannot act in a void.'),
('manualArchive.fail.notFound', 'default', 'I have searched this channel, but I cannot find a message with that ID.'),

-- Search Command
('search.desc', 'default', 'To retrieve the record of a specific day.'),
('search.option.day.desc', 'default', 'The number of the day to search for.'),
('search.fail.notFound', 'default', 'There is no record for Day {day}.'),
('search.embed.title', 'default', 'On Day {day}'),
('search.embed.description', 'default', 'It was recorded on <t:{timestamp}:f>. You can [return to the original scene]({jumpUrl}) if you dare.'),
('search.embed.field.additionalMedia', 'default', 'Further Evidence'),
('search.embed.field.more', 'default', ' | and {remaining} more...'),

-- Status Command
('status.desc', 'default', 'To show which days are recorded and which are lost to time.'),
('status.option.start.desc', 'default', 'The starting day for the inquiry.'),
('status.option.end.desc', 'default', 'The ending day for the inquiry.'),
('status.fail.startAfterEnd', 'default', 'The beginning must come before the end. It is the law of time.'),
('status.embed.noData', 'default', 'There is nothing to report on this page.'),
('status.embed.title', 'default', 'A Reckoning of Days: {start} through {end}'),
('status.embed.footer', 'default', 'Page {page} of {totalPages}'),
('status.embed.dayStatus', 'default', 'Day {day}... {status}'),

-- Delete Confirmation Helper
('delete.confirm.button.confirm', 'default', 'Yes, Erase It'),
('delete.confirm.button.cancel', 'default', 'No, Forgive It'),
('delete.confirm.prompt', 'default', 'This action will remove Day(s) **{days}** from the record, perhaps forever. Are you truly certain?'),
('delete.confirm.success', 'default', 'It is gone. Day(s) **{days}** have been expunged from the archive.'),
('delete.confirm.fail', 'default', 'The deletion failed. The past resists erasure. The logs may explain this persistence.'),
('delete.confirm.cancelled', 'default', 'The decision is rescinded. Nothing has changed.'),
('delete.confirm.timeout', 'default', 'Indecision. The moment has passed, and the deletion is cancelled.'),

-- Manual Archive Helper
('manualArchive.modal.fail.noAttachments', 'default', 'This message holds nothing to archive. It is empty.'),
('manualArchive.modal.title', 'default', 'Manual Judgment'),
('manualArchive.modal.day.label', 'default', 'The Day Number'),
('manualArchive.modal.day.placeholder', 'default', 'e.g., 123... a number like any other'),
('manualArchive.reply.fail.invalidDay', 'default', 'You must provide a real number. A positive integer. This is not a game.'),
('manualArchive.reply.fail.exists', 'default', 'Impossible. A memory for Day {day} already exists. I cannot create another.'),
('manualArchive.reply.success', 'default', 'Very well. Day {day} has been manually recorded.'),
('manualArchive.reply.fail.generic', 'default', 'I could not create the archive. It was not meant to be.'),

-- Archive Session Manager
('session.alert.sequence', 'default', 'A disruption. I was expecting Day `{expectedDay}`, but I have been given Day `{day}`. This is the [message in question]({url}). What is to be done?'),
('session.button.forceArchive', 'default', 'Accept it as Day {day}'),
('session.button.ignorePost', 'default', 'Cast it aside'),
('session.alert.ambiguous', 'default', 'This is chaos. The message speaks of multiple days: {days}. I cannot untangle this. You must do it yourself, with `/manual-archive` and the message ID `{messageId}`. [Look upon the source]({url}) of this confusion.'),
('session.alert.lowConfidence', 'default', 'I see the number `{day}` here, but its meaning is veiled. A whisper of a day. Is this truly Day {day}? This is the [message]({url}). You must decide.'),
('session.button.confirmArchive', 'default', 'Yes, it is Day {day}'),
('session.button.ignore', 'default', 'No, it is nothing'),
('session.alert.mediaOnly', 'default', 'An image has appeared, but without a number. A silent testament. Is this part of the chronicle? [Here is the image]({url}).'),
('session.button.addDayInfo', 'default', 'Yes, assign a day'),
('session.button.notArchive', 'default', 'No, it is irrelevant'),
('session.reply.fail.noMessage', 'default', 'The original message... it has vanished. I cannot proceed.'),
('session.reply.archiveSuccess', 'default', 'Confirmed. It has been archived as Day {day}. The record is updated.'),
('session.modal.addDay.title', 'default', 'Assign Day Information'),
('session.modal.addDay.label', 'default', 'What day number does this image belong to?'),
('session.reply.ignored', 'default', 'As you wish. The post is ignored.'),
('session.reply.fail.invalidDay', 'default', 'That is not a valid day number.'),
('session.reply.fail.exists', 'default', 'A record for Day {day} already exists. It cannot be overwritten.'),
('session.reply.manualSuccess', 'default', 'It is done. The post is now recorded as Day {day}.'),

-- Notification Service
('notification.reminder.missingDay', 'default', 'The chronicle has stopped at Day `{maxDay}`. We were expecting Day `{expectedDay}`. Has it been forgotten?');

-- Populate the anime-girl persona and its dialogue strings.
INSERT OR IGNORE INTO personas (name, description) VALUES ('anime-girl', 'A cute, energetic, and slightly clumsy anime girl who loves to help... nya~!');

INSERT OR IGNORE INTO dialogue (key, persona_name, text) VALUES
-- Generic Errors
('error.generic', 'anime-girl', 'Uh oh! An ewwow occuwwed... I''m sowwy! (⁄ ⁄•⁄ω⁄•⁄ ⁄)'),
('error.generic.tryAgain', 'anime-girl', 'Oopsies! That didn''t work. Could you try again, pookie?'),
('error.noPermission', 'anime-girl', 'E-eh?! You can''t do that! You don''t have the wight pewmissions! (>_<)'),
('error.command.notFound', 'anime-girl', 'Nyan?! I looked evewywhewe, but I can''t find a command called `/{commandName}`! (´• ω •`)'),
('error.command.execution', 'anime-girl', 'Ah! Sowwy! Something went wwong when I twied to wun the command... (｡•́︿•̀｡)'),
('error.export.generic', 'anime-girl', 'Oh noes! The export faiwed... I''m weally sowwy! Maybe the logs can tell us why?'),

-- Export Command
('export.desc', 'anime-girl', 'Lets pack up all the Daily Johans into a wittle JSON fiwe! ✩°｡⋆'),
('export.generating', 'anime-girl', 'Okay! I''m gathering all the posts now... please wait a moment! (๑˃ᴗ˂)ﻭ'),
('export.empty', 'anime-girl', 'E-eh? Thewe''s nothing here to export! The awchive is all empty... (._.)'),
('export.fail.tooLarge', 'anime-girl', 'Waaah! The fiwe is too big! (>_<) Discord won''t let me send anything over 24MB. You''ll have to ask the bot ownew fow help!'),
('export.dm.content', 'anime-girl', 'Hewwo! Here is your database export, just fow you! ♡'),
('export.success.dm', 'anime-girl', 'Yay! I sent the export to your DMs! Check it out! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧'),
('export.fail.dm', 'anime-girl', 'Sowwy... I couldn''t send you a DM. (´• ω •`) Can you check your pwivacy settings and twy again, pwease?'),

-- Import Command
('import.desc', 'anime-girl', 'Let''s unpack a JSON fiwe and add all the posts! Fun! (≧◡≦)'),
('import.option.attachment.desc', 'anime-girl', 'The JSON fiwe you want to impowt~'),
('import.processing', 'anime-girl', 'Okay! I''m checking youw fiwe now... one moment pwease!~'),
('import.fail.notJson', 'anime-girl', 'Nyo! That''s not a JSON fiwe! It needs to end with `.json` pwease! ( `ε´ )'),
('import.fail.tooLarge', 'anime-girl', 'This fiwe is too big! Anything over 24MB is a no-go! (>_<)'),
('import.fail.parse', 'anime-girl', 'Hmmm... I can''t seem to wead this fiwe. Is it a pwopew JSON? (・_・?)'),
('import.success', 'anime-girl', 'Yay! Impowt compwete! ♡\n- **Posts Impowted:** `{importedCount}`\n- **Posts Skipped:** `{skippedCount}` (I awweady had these!)\n- **Totaw Pwocessed:** `{total}`'),
('import.fail.invalidFormat', 'anime-girl', 'Oopsies! This fiwe doesn''t wook wight... At `{path}`: {message}'),
('import.fail.database', 'anime-girl', 'Oh noes! A big ewwow happened while saving... but don''t wowwy, nothing was changed! The database is safe! ( ´•̥̥̥ω•̥̥̥` )'),

-- Settings Command
('settings.desc', 'anime-girl', 'Let''s change my settings! (｡•̀ᴗ-)✧'),
('settings.channel.desc', 'anime-girl', 'Sets the channel fow my notifications, wike wemindews and stuff!'),
('settings.channel.option.desc', 'anime-girl', 'The text channy-chan to send my messages to!'),
('settings.channel.fail.internal', 'anime-girl', 'Ehhh? I can''t check my own pewmissions... that''s weird!'),
('settings.channel.fail.perms', 'anime-girl', 'I can''t talk in {channel}! Pwease give me **View Channel** and **Send Messages** pewmissions, nya~!'),
('settings.channel.success', 'anime-girl', 'Otay! I''ll send my notifications to {channel} fwom now on! (´｡• ᵕ •｡`) ♡'),
('settings.channel.fail.save', 'anime-girl', 'I twied, but I couldn''t save the setting... (｡•́︿•̀｡)'),
('settings.timezone.desc', 'anime-girl', 'Sets my timezone so I know what time it is!'),
('settings.timezone.option.desc', 'anime-girl', 'An IANA timezone, wike Europe/London!'),
('settings.timezone.fail.invalid', 'anime-girl', '`{timezone}` is not a weal timezone! Pwease pick one fwom the list!'),
('settings.timezone.success', 'anime-girl', 'Oki doki! My timezone is now `{timezone}`!'),
('settings.timezone.fail.save', 'anime-girl', 'Sowwy, I couldn''t save the timezone...'),
('settings.reminder.desc', 'anime-girl', 'Lets configuwe the daily wemindew! UwU'),
('settings.reminder.option.status.desc', 'anime-girl', 'Do you want me to wemind you? Yes or no?'),
('settings.reminder.option.time.desc', 'anime-girl', 'What time should I wemind you? (24h HH:MM fowmat)'),
('settings.reminder.fail.noTime', 'anime-girl', 'You have to give me a time if you enabwe the wemindew, silly!'),
('settings.reminder.fail.invalidTime', 'anime-girl', 'That time fowmat is funny... it needs to be HH:MM pwease!'),
('settings.reminder.enable.success', 'anime-girl', 'Wemindews are ON! I''ll poke you at `{time}` evewy day!'),
('settings.reminder.disable.success', 'anime-girl', 'Wemindews are OFF! I''ll be quiet!'),
('settings.persona.desc', 'anime-girl', 'Change how I talk! My persona!'),
('settings.persona.set.desc', 'anime-girl', 'Sets my active persona!'),
('settings.persona.set.option.name.desc', 'anime-girl', 'The name of the persona to become!'),
('settings.persona.list.desc', 'anime-girl', 'Lists all the ways I can be!'),
('settings.persona.set.success', 'anime-girl', 'Okay! I''ve changed my persona to `{name}`! Do you wike it?'),
('settings.persona.set.fail.notFound', 'anime-girl', 'Ehhh? I don''t know how to be `{name}`... Use `/settings persona list` to see who I can be!'),
('settings.persona.set.fail.generic', 'anime-girl', 'I couldn''t change my persona... sowwy!'),
('settings.persona.list.title', 'anime-girl', 'These are my avaiwabuw personas~! ♡'),
('settings.persona.list.activeSuffix', 'anime-girl', ' (This is me wight now!)'),
('settings.persona.list.empty', 'anime-girl', 'I can only be me... thewe are no other personas!'),
('settings.persona.list.fail.generic', 'anime-girl', 'I couldn''t get the wist of personas... sowwy!'),

-- Context Menu Commands
('context.archive.name', 'anime-girl', 'Awchive This! ☆'),
('context.delete.name', 'anime-girl', 'Dewete This Awchive Entwy!'),
('context.delete.fail.notRegistered', 'anime-girl', 'This message isn''t in the awchive, silly!'),

-- Delete Command
('delete.desc', 'anime-girl', 'Dewetes an awchive entwy... awe you suwe?'),
('delete.day.desc', 'anime-girl', 'Dewetes a specific day using its numbew.'),
('delete.day.option.day.desc', 'anime-girl', 'The day numbew to dewete.'),
('delete.link.desc', 'anime-girl', 'Dewetes an awchive entwy using the message wink.'),
('delete.link.option.message_link.desc', 'anime-girl', 'A wink to the Discord message to dewete fwom the awchive.'),
('delete.day.fail.notFound', 'anime-girl', 'UwU, no Daily Johan found for day {day}. Sowwy!'),
('delete.link.fail.invalid', 'anime-girl', 'Hmmm... that winky wink wooks funny. Is it vawid? OwO'),
('delete.link.fail.notFound', 'anime-girl', '｡ﾟ･ (>﹏<) ･ﾟ｡ I couwdn''t find any Dewy Johan fow that input.'),

-- Manual Archive Command
('manualArchive.desc', 'anime-girl', 'Manually awchives a post using its message ID!'),
('manualArchive.option.message_id.desc', 'anime-girl', 'The ID of the message to awchive.'),
('manualArchive.fail.noChannel', 'anime-girl', 'You have to wun this in a channy-chan!'),
('manualArchive.fail.notFound', 'anime-girl', 'I-I''m so sowwy! I can''t find the message with that ID in this channy-chan. Can you check it again?'),

-- Search Command
('search.desc', 'anime-girl', 'Finds a specific day''s awchive!'),
('search.option.day.desc', 'anime-girl', 'The day numbew to seawch for.'),
('search.fail.notFound', 'anime-girl', 'UwU, no Daily Johan found for day {day}. Sowwy!'),
('search.embed.title', 'anime-girl', 'Hehe, found it! Awchive fow Day {day}!'),
('search.embed.description', 'anime-girl', 'I awchived this on <t:{timestamp}:f>.\n[Jump to the message!]({jumpUrl})'),
('search.embed.field.additionalMedia', 'anime-girl', 'Extwa Stuff!'),
('search.embed.field.more', 'anime-girl', ' | and {remaining} mowe~!'),

-- Status Command
('status.desc', 'anime-girl', 'Shows which days awe awchived or missing! Let''s check!'),
('status.option.start.desc', 'anime-girl', 'The stawting day numbew.'),
('status.option.end.desc', 'anime-girl', 'The ending day numbew.'),
('status.fail.startAfterEnd', 'anime-girl', 'Silly! The stawt day has to be befowe the end day!'),
('status.embed.noData', 'anime-girl', 'No data on this page! (´｡• ᵕ •｡`)'),
('status.embed.title', 'anime-girl', 'Status fow Days {start} - {end}!'),
('status.embed.footer', 'anime-girl', 'Page {page} of {totalPages}'),
('status.embed.dayStatus', 'anime-girl', 'Day {day}: {status}'),

-- Delete Confirmation Helper
('delete.confirm.button.confirm', 'anime-girl', 'Yes, Dewete it!'),
('delete.confirm.button.cancel', 'anime-girl', 'No, Keep it!'),
('delete.confirm.prompt', 'anime-girl', 'Ummm... awe you suwe you want to dewete the awchived Daily Johan fow day(s) **{days}**? It''ll be gone fowevew!'),
('delete.confirm.success', 'anime-girl', 'Goodbye! Archived Daiwy Johan fow day(s) **{days}** has been deweted 。。。ミヽ(。＞＜)ノ'),
('delete.confirm.fail', 'anime-girl', 'Uh oh! An ewwow occuwwed and I couldn''t dewete it! Sowwy...'),
('delete.confirm.cancelled', 'anime-girl', 'Otay! Dewetion cancewwed, nya~!'),
('delete.confirm.timeout', 'anime-girl', 'You took too long to decide... so I cancewwed it!'),

-- Manual Archive Helper
('manualArchive.modal.fail.noAttachments', 'anime-girl', 'UwU no media found on that message... Could you try again, pookie?'),
('manualArchive.modal.title', 'anime-girl', 'Manual Awchive!'),
('manualArchive.modal.day.label', 'anime-girl', 'Day Numbew, pwease!'),
('manualArchive.modal.day.placeholder', 'anime-girl', 'e.g., 123'),
('manualArchive.reply.fail.invalidDay', 'anime-girl', 'I- I''m sowwy!!! I couldn''t undewstand that day numbew (￣▽￣*)ゞ'),
('manualArchive.reply.fail.exists', 'anime-girl', 'Oops! Day {day} already has a Daily Johan awchived.'),
('manualArchive.reply.success', 'anime-girl', 'Yay! I awchived it fow Day {day}! You did it!✨'),
('manualArchive.reply.fail.generic', 'anime-girl', 'I twied my best but I couldn''t cweate the awchive... sowwy!'),

-- Archive Session Manager
('session.alert.sequence', 'anime-girl', '(✿>ꇴ<) Day `{day}` doesn’t seem wike the next expected day (`{expectedDay}`)... Is this intewntionaw, pookie? Pwease confiwm! [Here''s the message!]({url}) ꒰⑅ᵕ༚ᵕ꒱˖♡'),
('session.button.forceArchive', 'anime-girl', 'Yes, Awchive as Day {day}'),
('session.button.ignorePost', 'anime-girl', 'No, Ignowe It'),
('session.alert.ambiguous', 'anime-girl', 'My snuggy wuggy bear, are u trying to catch up dailies? I see multiple days ({days})! :Flirt: Pwease use `/manual-archive` with message ID `{messageId}` for each one! [This is the message!]({url})'),
('session.alert.lowConfidence', 'anime-girl', 'Hmm... I see the number `{day}`... but I''m not suwe! (*/▽＼*) Is this weally Day {day}? You should check the [owiginal message]({url}) and tell me!'),
('session.button.confirmArchive', 'anime-girl', 'Yes, Confiwm Day {day}'),
('session.button.ignore', 'anime-girl', 'No, Ignowe'),
('session.alert.mediaOnly', 'anime-girl', 'Hewwooo~ Is this a Daiwy Johan?! ✩°｡⋆⸜(ू｡•ω•｡) If it is, pwease tell me the day numbew! If nyot, just ignowe me! [Here''s the message!]({url}) (=^-ω-^=)'),
('session.button.addDayInfo', 'anime-girl', 'Yes, Add Day Info!'),
('session.button.notArchive', 'anime-girl', 'No, Not an Awchive'),
('session.reply.fail.noMessage', 'anime-girl', 'Sowwy! I can''t find the owiginal message anymowe...'),
('session.reply.archiveSuccess', 'anime-girl', 'Undewstood!!! \(｡>‿‿<｡) Pwocweeding with awchiving fow day {day}. ✨UwU✨'),
('session.modal.addDay.title', 'anime-girl', 'Add Day Info to Awchive!'),
('session.modal.addDay.label', 'anime-girl', 'What day numbew should this be?'),
('session.reply.ignored', 'anime-girl', 'Oki doki! I''ll ignowe this post then!'),
('session.reply.fail.invalidDay', 'anime-girl', 'I- I''m sowwy!!! I couldn''t parse a day number from your reply (￣▽￣*)ゞ'),
('session.reply.fail.exists', 'anime-girl', 'Oops! Day {day} already has a Daily Johan awchived. No new awchive needed.'),
('session.reply.manualSuccess', 'anime-girl', 'Yay! I awchived it fow Day {day}! You did it!✨'),

-- Notification Service
('notification.reminder.missingDay', 'anime-girl', 'Dear pookie bear, you haven''t done the Daily Johan for day `{expectedDay}` yet! The last one was `{maxDay}`! UwU');