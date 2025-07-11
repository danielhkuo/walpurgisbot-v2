// src/config.ts
import 'dotenv/config';
import { z } from 'zod';
import logger from './logger';

const envSchema = z.object({
    // Use Bun.env here for the build-time check, but it will fall back to process.env at runtime.
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    TOKEN: z.string().min(1, { message: "TOKEN is required" }),
    CLIENT_ID: z.string().min(1, { message: "CLIENT_ID is required" }),
    GUILD_ID: z.string().min(1, { message: "GUILD_ID is required for dev" }),
    JOHAN_USER_ID: z.string().min(1, { message: "JOHAN_USER_ID is required" }),
    ADMIN_ROLE_ID: z.string().min(1, { message: "ADMIN_ROLE_ID is required" }),
    DATABASE_PATH: z.string().default('walpurgis.db'),
    
    DEFAULT_CHANNEL_ID: z.string().optional(),
    TIMEZONE: z.string().optional(),
});

let validatedConfig;

try {
    // Bun automatically merges Bun.env into process.env, so this works for both build and runtime.
    validatedConfig = envSchema.parse(process.env);
    logger.info('Configuration loaded and validated successfully.');
} catch (error) {
    logger.fatal({ err: (error as z.ZodError).format() }, 'Failed to load configuration from environment variables.');
    process.exit(1);
}

export const config = validatedConfig;