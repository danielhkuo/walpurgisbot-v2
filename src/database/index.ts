// src/database/index.ts
import BetterSqlite3 from 'better-sqlite3';
import logger from '../logger';
import { config } from '../config';
import { runMigrations } from './migrate';

// Make sure your original schema.sql is moved into a migration file if needed.
// For a new setup, your first migration can contain the initial schema.

const db = new BetterSqlite3(config.DATABASE_PATH);
logger.info(`Database connected at ${config.DATABASE_PATH}`);

db.pragma('journal_mode = WAL');

// Run migrations on startup
runMigrations(db, logger);

export default db;