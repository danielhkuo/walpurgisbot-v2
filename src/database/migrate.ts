// src/database/migrate.ts
import type { Database } from 'bun:sqlite';
import path from 'node:path';
import type { Logger } from 'pino';

// By explicitly listing migration files, we ensure they run in order.
const MIGRATION_FILES = ['000_initial_schema.sql'];

export async function runMigrations(db: Database, logger: Logger): Promise<void> {
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
    const ranMigrations = db.query('SELECT name FROM migrations').all() as { name: string }[];
    const ranMigrationNames = new Set(ranMigrations.map(m => m.name));

    // 3. Run any migrations that have not been run yet
    const insertMigrationStmt = db.prepare('INSERT INTO migrations (name) VALUES (?)');

    for (const migrationFile of MIGRATION_FILES) {
        if (!ranMigrationNames.has(migrationFile)) {
            logger.info(`Running migration: ${migrationFile}`);
            try {
                // Bun.file() combined with --compile embeds the asset into the binary.
                // import.meta.dir gives us the correct path relative to the source file.
                const migrationPath = path.join(import.meta.dir, 'migrations', migrationFile);
                const sql = await Bun.file(migrationPath).text();
                
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