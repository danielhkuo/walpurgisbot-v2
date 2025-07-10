// src/lib/handler.ts
import type { Client } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from '../types/command';
import type { Event } from '../types/event';
import type { MessageContextMenuCommand } from '../types/contextMenuCommand';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function* getCommandFiles(dir: string): AsyncGenerator<string> {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getCommandFiles(res);
        } else if (res.endsWith('.ts')) {
            yield res;
        }
    }
}

export async function loadCommands(client: Client) {
    const commandsPath = path.join(__dirname, '../commands');

    for await (const filePath of getCommandFiles(commandsPath)) {
        try {
            const { command } = (await import(filePath)) as { command: Command | MessageContextMenuCommand };
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                client.logger.debug(`Loaded command: ${command.data.name}`);
            } else {
                client.logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        } catch (error) {
            client.logger.error({ err: error, file: filePath }, 'Error loading a command file.');
        }
    }
}

export async function loadEvents(client: Client) {
    const eventsPath = path.join(__dirname, '../events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.ts'));

    for (const file of eventFiles) {
        try {
            const filePath = path.join(eventsPath, file);
            const { event } = (await import(filePath)) as { event: Event };
            if (event.once) {
                client.once(event.name, (...args) => event.execute(client, ...args));
            } else {
                client.on(event.name, (...args) => event.execute(client, ...args));
            }
            client.logger.debug(`Loaded event: ${event.name}`);
        } catch (error) {
            client.logger.error({ err: error, file }, 'Error loading an event file.');
        }
    }
}