// src/database/index.ts
import { Database } from 'bun:sqlite';
import logger from '../logger';
import { config } from '../config';

const db = new Database(config.DATABASE_PATH);
logger.info(`Database connected at ${config.DATABASE_PATH}`);

// WAL mode is enabled by default in Bun's SQLite, so no pragma is needed here.

export default db;