// src/database/migrate.ts
import type { Database } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(db: Database, logger: Logger) {
    logger.info('Running database migrations...');

    // 1. Create migrations table if it doesn't exist
    db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // 2. Get all migrations that have already been run
    const ranMigrations = db.prepare('SELECT name FROM migrations').all() as { name: string }[];
    const ranMigrationNames = new Set(ranMigrations.map(m => m.name));

    // 3. Read all available migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const availableMigrations = fs
        .readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensure they run in order (e.g., 001, 002, ...)

    // 4. Run any migrations that have not been run yet
    const insertMigrationStmt = db.prepare('INSERT INTO migrations (name) VALUES (?)');

    for (const migrationFile of availableMigrations) {
        if (!ranMigrationNames.has(migrationFile)) {
            logger.info(`Running migration: ${migrationFile}`);
            try {
                const sql = fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf8');
                db.exec(sql);
                insertMigrationStmt.run(migrationFile);
            } catch (error) {
                logger.fatal({ err: error, migration: migrationFile }, 'Failed to run migration. Exiting.');
                process.exit(1);
            }
        }
    }

    logger.info('Database migrations complete.');
}