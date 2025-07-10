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

// Add this exported type for creating new posts.
export type CreatePostInput = Omit<Post, 'confirmed'> & { mediaUrls: string[] };