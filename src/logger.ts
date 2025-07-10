// src/logger.ts
import pino from 'pino';

// We'll create config.ts next, for now we can reference process.env
const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
    level: isProduction ? 'info' : 'debug',
    transport: !isProduction
        ? { target: 'pino-pretty' }
        : undefined,
});

export default logger;