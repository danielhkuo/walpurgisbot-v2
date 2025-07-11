-- Migration 002: Add tracking for reminder checks
-- This column stores the UNIX timestamp of the last time the daily reminder
-- check was successfully executed. This is critical for the "catch-up" logic
-- to determine if a check was missed during bot downtime.
ALTER TABLE notification_settings
ADD COLUMN last_reminder_check_timestamp INTEGER;