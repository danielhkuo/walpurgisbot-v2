// src/lib/clear-commands.ts
import { REST, Routes } from 'discord.js';
import { config } from '../config'; // Your existing config loader
import logger from '../logger';   // Your existing logger

// This script will remove ALL commands, both GLOBAL and from your specific GUILD.
// This is the definitive way to clear out a bot's command cache before a redeploy.

const rest = new REST().setToken(config.TOKEN);

/**
 * Deletes all global commands for the bot application.
 * These are commands available in all servers and DMs.
 */
async function clearGlobalCommands() {
    try {
        logger.info('Started clearing GLOBAL application (/) commands.');

        // Fetch all global commands
        const commands = await rest.get(Routes.applicationCommands(config.CLIENT_ID)) as { id: string }[];
        
        if (commands.length === 0) {
            logger.info('No global commands found to clear.');
            return;
        }

        logger.info(`Found ${commands.length} global commands to delete.`);

        // The body is an empty array, which tells Discord to remove all commands.
        await rest.put(
            Routes.applicationCommands(config.CLIENT_ID),
            { body: [] },
        );

        logger.info('Successfully cleared GLOBAL application (/) commands.');
    } catch (error) {
        logger.error({ err: error }, 'Error clearing GLOBAL commands');
    }
}


/**
 * Deletes all commands registered to a specific guild.
 * These are the commands used for development and testing.
 */
async function clearGuildCommands() {
    // We only run this if a GUILD_ID is provided.
    if (!config.GUILD_ID) {
        logger.warn('No GUILD_ID provided in .env, skipping guild command cleanup.');
        return;
    }

    try {
        logger.info(`Started clearing application (/) commands for GUILD: ${config.GUILD_ID}`);
        
        // Fetch all guild commands
        const commands = await rest.get(Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID)) as { id: string }[];
        
        if (commands.length === 0) {
            logger.info('No guild-specific commands found to clear.');
            return;
        }

        logger.info(`Found ${commands.length} guild-specific commands to delete.`);

        // The body is an empty array, which tells Discord to remove all commands.
        await rest.put(
            Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
            { body: [] },
        );

        logger.info('Successfully cleared application (/) commands for the guild.');
    } catch (error) {
        logger.error({ err: error }, 'Error clearing guild commands');
    }
}


async function main() {
    await clearGlobalCommands();
    await clearGuildCommands();
    logger.info('Command cleanup process finished.');
}

// This allows you to run the file directly using `bun run <path>`
void main();