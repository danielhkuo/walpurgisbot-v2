// src/database/index.ts
import { Database } from 'bun:sqlite';
import logger from '../logger';
import { config } from '../config';
import { runMigrations } from './migrate';

// Make sure your original schema.sql is moved into a migration file if needed.
// For a new setup, your first migration can contain the initial schema.

const db = new Database(config.DATABASE_PATH);
logger.info(`Database connected at ${config.DATABASE_PATH}`);

// WAL mode is enabled by default in Bun's SQLite, so no pragma is needed.

// Run migrations on startup
runMigrations(db, logger);

export default db;