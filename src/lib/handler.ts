// src/lib/handler.ts
import fs from 'fs/promises';
import path from 'path';
import type { Client } from 'discord.js';
import type { Command } from '../types/command';
import type { MessageContextMenuCommand } from '../types/contextMenuCommand';
import type { Event } from '../types/event';

async function* getFiles(dir: string, extension: string): AsyncGenerator<string> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getFiles(res, extension);
        } else if (res.endsWith(extension)) {
            yield res;
        }
    }
}

export async function loadCommands(client: Client): Promise<void> {
    const commandsPath = path.join(__dirname, '../commands');
    
    try {
        for await (const filePath of getFiles(commandsPath, '.ts')) {
            try {
                const { command } = await import(filePath) as { command: Command | MessageContextMenuCommand };
                if (command && command.data) {
                    client.commands.set(command.data.name, command);
                    client.logger.info(`Loaded command: ${command.data.name}`);
                }
            } catch (error) {
                client.logger.error({ err: error, filePath }, 'Failed to load command');
            }
        }
    } catch (error) {
        client.logger.error({ err: error }, 'Failed to load commands directory');
    }
}

export async function loadEvents(client: Client): Promise<void> {
    const eventsPath = path.join(__dirname, '../events');
    
    try {
        for await (const filePath of getFiles(eventsPath, '.ts')) {
            try {
                const { event } = await import(filePath) as { event: Event };
                if (event && event.name) {
                    if (event.once) {
                        client.once(event.name, (...args) => {
                            void event.execute(client, ...args);
                        });
                    } else {
                        client.on(event.name, (...args) => {
                            void event.execute(client, ...args);
                        });
                    }
                    client.logger.info(`Loaded event: ${event.name}`);
                }
            } catch (error) {
                client.logger.error({ err: error, filePath }, 'Failed to load event');
            }
        }
    } catch (error) {
        client.logger.error({ err: error }, 'Failed to load events directory');
    }
}