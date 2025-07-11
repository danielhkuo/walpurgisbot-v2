// src/lib/deploy-commands.ts
import { REST, Routes } from 'discord.js';
import { config } from '../config';
import logger from '../logger';

const rest = new REST().setToken(config.TOKEN);

async function deployCommands() {
    try {
        logger.info('Started refreshing application (/) commands.');

        // Get all command files
        const commands: unknown[] = [];
        
        // You would typically load your commands here
        // This is just a placeholder for the structure
        
        await rest.put(
            Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
            { body: commands },
        );

        logger.info('Successfully reloaded application (/) commands.');
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

if (require.main === module) {
    void main();
}