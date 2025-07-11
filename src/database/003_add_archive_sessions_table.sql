-- Migration 003: Add archive_sessions table
-- This table persists the state of in-progress archive sessions, making them
-- fault-tolerant and able to survive bot restarts.

CREATE TABLE archive_sessions (
    -- The user ID is the primary key, as a user can only have one session at a time.
    user_id TEXT PRIMARY KEY,
    
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL, -- The ID of the message that initiated the session (usually the one with media).
    
    -- These fields store arrays as JSON strings, which is simple and effective for this use case.
    media_urls TEXT NOT NULL,
    detected_days TEXT NOT NULL,
    
    confidence TEXT NOT NULL,
    
    -- A UNIX timestamp in seconds indicating when this session should be considered expired.
    expires_at INTEGER NOT NULL,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON archive_sessions(expires_at);