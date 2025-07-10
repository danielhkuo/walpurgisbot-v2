// src/lib/deploy-commands.ts
import { REST, Routes } from 'discord.js';
import { config } from '../config';
import logger from '../logger';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from '../types/command';
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

const commands = [];
const commandsPath = path.join(__dirname, '../commands');

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for await (const filePath of getCommandFiles(commandsPath)) {
    const { command } = (await import(filePath)) as { command: Command | MessageContextMenuCommand };
    if (command && command.data) {
        commands.push(command.data.toJSON());
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(config.TOKEN);

// and deploy your commands!
(async () => {
    try {
        logger.info(`Started refreshing ${commands.length} application commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data: any = await rest.put(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID), {
            body: commands,
        });

        logger.info(`Successfully reloaded ${data.length} application commands.`);
    } catch (error) {
        logger.error(error, 'Failed to refresh application commands.');
    }
})();