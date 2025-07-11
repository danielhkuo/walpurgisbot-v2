-- src/database/migrations/004_add_session_message_id_index.sql
-- Migration 004: Add index for message_id on archive_sessions
-- This improves the performance of looking up a session by its anchor message ID,
-- preventing a full table scan.
CREATE INDEX IF NOT EXISTS idx_sessions_message_id ON archive_sessions(message_id);