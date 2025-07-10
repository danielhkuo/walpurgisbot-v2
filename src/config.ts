// src/config.ts
import 'dotenv/config';
import { z } from 'zod';
import logger from './logger';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    TOKEN: z.string().min(1, { message: "TOKEN is required" }),
    CLIENT_ID: z.string().min(1, { message: "CLIENT_ID is required" }),
    GUILD_ID: z.string().min(1, { message: "GUILD_ID is required for dev" }),
    JOHAN_USER_ID: z.string().min(1, { message: "JOHAN_USER_ID is required" }),
    DATABASE_PATH: z.string().default('walpurgis.db'),
    COOLDOWN_HOURS: z.coerce.number().int().positive().default(12),
    
    // --- NEW: Optional fallback values for notifications ---
    DEFAULT_CHANNEL_ID: z.string().optional(),
    TIMEZONE: z.string().optional(), // Should be an IANA timezone string e.g. "Europe/Berlin"
});

let validatedConfig;

try {
    validatedConfig = envSchema.parse(process.env);
    logger.info('Configuration loaded and validated successfully.');
} catch (error) {
    // We log the specific Zod error for better debugging.
    logger.fatal({ err: (error as z.ZodError).format() }, 'Failed to load configuration from environment variables.');
    process.exit(1);
}

// Export the validated config using ESM syntax.
export const config = validatedConfig;