// src/lib/check-commands.ts
import { REST, Routes } from 'discord.js';
import { config } from '../config';
import logger from '../logger';

const rest = new REST().setToken(config.TOKEN);

async function checkGuildCommands() {
    if (!config.GUILD_ID) {
        logger.fatal('GUILD_ID is not defined in your .env file. Aborting check.');
        process.exit(1);
    }

    try {
        logger.info(`Fetching commands for GUILD: ${config.GUILD_ID}...`);

        const commands = await rest.get(
            Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID)
        ) as { name: string; description: string }[];

        if (commands.length === 0) {
            logger.info('✅ SUCCESS: There are currently NO commands registered to this guild.');
            return;
        }

        logger.info(`🔎 Found ${commands.length} commands registered to this guild:`);
        for (const command of commands) {
            // Your new commands have descriptions, old ones might not.
            const desc = command.description ? `- "${command.description}"` : '';
            logger.info(`  - /${command.name} ${desc}`);
        }
        
    } catch (error) {
        logger.error({ err: error }, 'Error fetching guild commands');
    }
}

void checkGuildCommands();