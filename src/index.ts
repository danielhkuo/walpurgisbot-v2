// src/index.ts
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import db from './database';
import { runMigrations } from './database/migrate';
import { PostRepository } from './database/postRepository';
import { SettingsRepository } from './database/settingsRepository';
import { SessionRepository } from './database/sessionRepository';
import { NotificationService } from './services/notificationService';
import { ArchiveSessionManager } from './services/archiveSessionManager';
import { DialogueService } from './services/dialogueService';
import { FunService } from './services/funService';
import type { Command } from './types/command';
import type { MessageContextMenuCommand } from './types/contextMenuCommand';
import { registerCommands, registerEvents } from './registry';
import logger from './logger';
import { config } from './config';
import type { Database } from 'bun:sqlite';

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, Command | MessageContextMenuCommand>;
        db: Database;
        posts: PostRepository;
        settings: SettingsRepository;
        sessions: SessionRepository;
        notificationService: NotificationService;
        archiveSessionManager: ArchiveSessionManager;
        dialogueService: DialogueService;
        funService: FunService;
        logger: typeof logger;
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

function setupClient() {
    client.logger = logger;
    client.db = db;
    client.posts = new PostRepository(client.db);
    client.settings = new SettingsRepository(client.db);
    client.sessions = new SessionRepository(client.db);
    client.notificationService = new NotificationService(client, client.settings, client.posts);
    client.archiveSessionManager = new ArchiveSessionManager(client, client.posts, client.sessions);
    client.dialogueService = new DialogueService(client);
    client.funService = new FunService(client);
    client.commands = new Collection();
    
    registerCommands(client);
    registerEvents(client);
}

async function main() {
    try {
        await runMigrations(db, logger);

        setupClient();
        
        await client.login(config.TOKEN);
    } catch (error) {
        logger.fatal({ err: error }, 'Failed to start bot');
        process.exit(1);
    }
}

void main();

export default client;