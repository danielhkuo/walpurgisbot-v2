// src/registry.ts

import type { Client } from 'discord.js';

// --- Import All Commands ---
import { command as exportCommand } from './commands/admin/export';
import { command as importCommand } from './commands/admin/import';
import { command as settingsCommand } from './commands/admin/settings';
import { command as archiveContextCommand } from './commands/context/archiveContext';
import { command as deleteContextCommand } from './commands/context/deleteContext';
import { command as deleteCommand } from './commands/delete';
import { command as manualArchiveCommand } from './commands/manual-archive';
import { command as searchCommand } from './commands/search';
import { command as statusCommand } from './commands/status';

// --- Import All Events ---
import { event as interactionCreateEvent } from './events/interactionCreate';
import { event as messageCreateEvent } from './events/messageCreate';
import { event as readyEvent } from './events/ready';

const commands = [
    exportCommand,
    importCommand,
    settingsCommand,
    archiveContextCommand,
    deleteContextCommand,
    deleteCommand,
    manualArchiveCommand,
    searchCommand,
    statusCommand,
];

export function registerCommands(client: Client): void {
    for (const command of commands) {
        client.commands.set(command.data.name, command);
        client.logger.info(`Registered command: ${command.data.name}`);
    }
}

export function registerEvents(client: Client): void {
    // Register each event individually with proper typing
    if (readyEvent.once) {
        client.once(readyEvent.name, (...args) => {
            void readyEvent.execute(client, ...args);
        });
    } else {
        client.on(readyEvent.name, (...args) => {
            void readyEvent.execute(client, ...args);
        });
    }
    client.logger.info(`Registered event: ${readyEvent.name}`);

    if (interactionCreateEvent.once) {
        client.once(interactionCreateEvent.name, (...args) => {
            void interactionCreateEvent.execute(client, ...args);
        });
    } else {
        client.on(interactionCreateEvent.name, (...args) => {
            void interactionCreateEvent.execute(client, ...args);
        });
    }
    client.logger.info(`Registered event: ${interactionCreateEvent.name}`);

    if (messageCreateEvent.once) {
        client.once(messageCreateEvent.name, (...args) => {
            void messageCreateEvent.execute(client, ...args);
        });
    } else {
        client.on(messageCreateEvent.name, (...args) => {
            void messageCreateEvent.execute(client, ...args);
        });
    }
    client.logger.info(`Registered event: ${messageCreateEvent.name}`);
} 