// src/types/database.ts
import { z } from 'zod';

export const PostSchema = z.object({
    day: z.number().int().positive(),
    message_id: z.string(),
    channel_id: z.string(),
    user_id: z.string(),
    timestamp: z.number().int(), 
    // The transform ensures we get a boolean in our code, even though it's 0/1 in the DB.
    confirmed: z.number().transform(val => val === 1),
});
export type Post = z.infer<typeof PostSchema>;

export const MediaAttachmentSchema = z.object({
    id: z.number().int().positive(),
    post_day: z.number().int().positive(),
    url: z.string().url(),
});
export type MediaAttachment = z.infer<typeof MediaAttachmentSchema>;

export type CreatePostInput = Omit<Post, 'confirmed'> & { mediaUrls: string[] };

export const MaxDaySchema = z.object({ maxDay: z.number().nullable() });
export const DayListSchema = z.array(z.object({ day: z.number() }));

export const NotificationSettingsSchema = z.object({
    id: z.literal(1),
    notification_channel_id: z.string().nullable(),
    timezone: z.string().nullable(),
    reminder_enabled: z.number().transform(val => val === 1),
    reminder_time: z.string().nullable(),
    report_enabled: z.number().transform(val => val === 1),
    report_frequency: z.string().nullable(),
    report_time: z.string().nullable(),
    last_reminder_sent_day: z.number().nullable(),
    last_reminder_check_timestamp: z.number().int().nullable(),
});

export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;