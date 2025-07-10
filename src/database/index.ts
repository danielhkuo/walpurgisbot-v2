// src/database/index.ts
import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import logger from '../logger';
import { config } from '../config';

const db = new BetterSqlite3(config.DATABASE_PATH);
logger.info(`Database connected at ${config.DATABASE_PATH}`);

db.pragma('journal_mode = WAL'); // For better performance

try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    logger.info('Database schema initialized.');
} catch (error) {
    logger.error({ err: error }, 'Failed to initialize database schema.');
    process.exit(1);
}

export default db;