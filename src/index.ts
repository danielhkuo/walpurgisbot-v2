// src/index.ts
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from './config';
import logger from './logger';
import db from './database';
import { PostRepository } from './database/postRepository';
import { SettingsRepository } from './database/settingsRepository';
import { NotificationService } from './services/notificationService';
import { ArchiveSessionManager } from './services/archiveSessionManager';
import type { Command } from './types/command';
import { loadCommands, loadEvents } from './lib/handler';
import type { Database } from 'better-sqlite3';

declare module 'discord.js' {
    export interface Client {
        commands: Collection<string, Command>;
        db: Database;
        posts: PostRepository;
        settings: SettingsRepository;
        notificationService: NotificationService;
        archiveSessionManager: ArchiveSessionManager;
        logger: typeof logger;
    }
}

async function main() {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    }) as Client;

    // --- DEPENDENCY INJECTION ---
    client.logger = logger;
    client.db = db;
    client.posts = new PostRepository(client.db);
    client.settings = new SettingsRepository(client.db);
    client.notificationService = new NotificationService(client, client.settings, client.posts);
    client.archiveSessionManager = new ArchiveSessionManager(client, client.posts);
    client.commands = new Collection();
    
    await loadCommands(client);
    await loadEvents(client);
    
    client.logger.info('Starting bot...');    
    await client.login(config.TOKEN);
}

main().catch(error => {
    logger.fatal({ err: error }, 'Unhandled error in main function.');
    process.exit(1);
});