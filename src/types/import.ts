/**
 * @fileoverview Defines Zod schemas for validating V1 and V2 import files.
 * This ensures type safety and data integrity before database operations.
 */

import { z } from 'zod';

/**
 * Schema for a post object as exported from a V1 bot.
 * It features denormalized, optional media URLs.
 *
 * We apply .passthrough() here specifically to allow this schema to gracefully
 * ignore extra legacy fields (e.g., 'user_mention') from old V1 exports
 * without causing a validation error.
 */
const V1ImportPostSchema = z
  .object({
    day: z.number().int().positive(),
    message_id: z.string(),
    channel_id: z.string(),
    user_id: z.string(),
    timestamp: z.number().int(),
    media_url1: z.string().url().nullable().optional(),
    media_url2: z.string().url().nullable().optional(),
    media_url3: z.string().url().nullable().optional(),
  })
  .passthrough();

/**
 * Schema for a post object as exported from a V2 bot.
 * It features a normalized array of media URLs. This schema is strict and
 * does not use .passthrough().
 */
const V2ImportPostSchema = z.object({
  day: z.number().int().positive(),
  message_id: z.string(),
  channel_id: z.string(),
  user_id: z.string(),
  timestamp: z.number().int(),
  media: z.array(z.string().url()),
});

/**
 * A flexible schema that accepts either the passthrough V1 or strict V2
 * post formats.
 */
export const ImportPostSchema = z.union([V1ImportPostSchema, V2ImportPostSchema]);

/**
 * The definitive schema for a full import file, which is an array of posts.
 */
export const ImportFileSchema = z.array(ImportPostSchema);

/**
 * The TypeScript type inferred from the flexible post schema.
 * This type will be used in the repository and command logic.
 */
export type ImportPost = z.infer<typeof ImportPostSchema>;