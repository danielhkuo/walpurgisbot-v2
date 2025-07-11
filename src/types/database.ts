// src/types/database.ts
import { z } from 'zod';

export const PostSchema = z.object({
    day: z.number().int().positive(),
    message_id: z.string(),
    channel_id: z.string(),
    user_id: z.string(),
    timestamp: z.number().int(),
    confirmed: z.number().int().default(1),
});

export type Post = z.infer<typeof PostSchema>;

export const MediaAttachmentSchema = z.object({
    id: z.number().int(),
    post_day: z.number().int().positive(),
    url: z.string().url(),
});

export type MediaAttachment = z.infer<typeof MediaAttachmentSchema>;

export const ArchiveSessionSchema = z.object({
    user_id: z.string(),
    channel_id: z.string(),
    message_id: z.string(),
    media_urls: z.array(z.string().url()),
    detected_days: z.array(z.number().int().positive()),
    confidence: z.enum(['high', 'low', 'none']),
    expires_at: z.number().int(),
});

export type ArchiveSession = z.infer<typeof ArchiveSessionSchema>;

export const NotificationSettingsSchema = z.object({
    id: z.literal(1).default(1),
    notification_channel_id: z.string().nullable(),
    timezone: z.string().nullable(),
    reminder_enabled: z.boolean(),
    reminder_time: z.string().nullable(),
    report_enabled: z.boolean(),
    report_frequency: z.string().nullable(),
    report_time: z.string().nullable(),
    last_reminder_sent_day: z.number().int().nullable(),
    last_reminder_check_timestamp: z.number().int().nullable(),
    active_persona_name: z.string(),
});

export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

// Additional schemas for PostRepository operations
export const CreatePostInputSchema = z.object({
    day: z.number().int().positive(),
    message_id: z.string(),
    channel_id: z.string(),
    user_id: z.string(),
    timestamp: z.number().int(),
    mediaUrls: z.array(z.string()),
});

export type CreatePostInput = z.infer<typeof CreatePostInputSchema>;

export const MaxDaySchema = z.object({
    maxDay: z.number().int().nullable(),
});

export const DayListSchema = z.array(z.object({
    day: z.number().int().positive(),
}));