// src/logger.ts
import pino from 'pino';

// Use Bun.env to ensure the value is embedded at compile time.
// Default to 'development' if not set.
const isProduction = Bun.env.NODE_ENV === 'production';

const logger = pino({
    level: isProduction ? 'info' : 'debug',
    // This conditional logic will now be correctly resolved during the build.
    transport: !isProduction
        ? { target: 'pino-pretty' }
        : undefined,
});

export default logger;