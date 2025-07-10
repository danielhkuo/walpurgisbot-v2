-- src/database/schema.sql

-- Stores the core metadata for each daily post.
CREATE TABLE IF NOT EXISTS posts (
    day         INTEGER PRIMARY KEY,
    message_id  TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    timestamp   INTEGER NOT NULL,
    confirmed   INTEGER NOT NULL DEFAULT 1 -- Using INTEGER for boolean (0 or 1)
);

-- Stores media attachments, linking back to a post.
-- This allows for a one-to-many relationship (one post can have many attachments).
CREATE TABLE IF NOT EXISTS media_attachments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_day    INTEGER NOT NULL,
    url         TEXT NOT NULL,
    FOREIGN KEY (post_day) REFERENCES posts(day) ON DELETE CASCADE
);

-- Create indexes for faster lookups.
CREATE INDEX IF NOT EXISTS idx_media_post_day ON media_attachments(post_day);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_message_id ON posts(message_id);