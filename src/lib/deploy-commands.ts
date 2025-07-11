// src/lib/deploy-commands.ts
import { REST, Routes } from 'discord.js';
import { config } from '../config';
import logger from '../logger';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Command } from '../types/command';
import type { MessageContextMenuCommand } from '../types/contextMenuCommand';

const rest = new REST().setToken(config.TOKEN);

// This is a recursive file reader generator function.
// It will find all .ts files in a directory and its subdirectories.
async function* getFiles(dir: string): AsyncGenerator<string> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* getFiles(res);
        } else if (res.endsWith('.ts')) {
            yield res;
        }
    }
}

async function deployCommands() {
    try {
        const commandsToDeploy = [];
        const commandsPath = path.join(__dirname, '..', 'commands');

        logger.info('Scanning for command files...');
        
        for await (const filePath of getFiles(commandsPath)) {
            try {
                // Import the command file
                const { command } = await import(filePath) as { command: Command | MessageContextMenuCommand };
                if (command && command.data) {
                    // Extract the JSON representation of the command for deployment
                    commandsToDeploy.push(command.data.toJSON());
                    logger.info(`Found command to deploy: /${command.data.name}`);
                }
            } catch (error) {
                logger.error({ err: error, filePath }, 'Failed to load a command file during deployment scan.');
            }
        }

        if (commandsToDeploy.length === 0) {
            logger.warn('No commands were found to deploy. Aborting.');
            return;
        }

        logger.info(`Started refreshing ${commandsToDeploy.length} application (/) commands.`);

        // The body is now the array of command data
        const data = await rest.put(
            Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
            { body: commandsToDeploy },
        ) as unknown[];

        logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        logger.error({ err: error }, 'Error deploying commands');
    }
}

async function main() {
    try {
        await deployCommands();
    } catch (error) {
        logger.fatal({ err: error }, 'Failed to deploy commands');
        process.exit(1);
    }
}

// This allows the script to be run directly
void main();