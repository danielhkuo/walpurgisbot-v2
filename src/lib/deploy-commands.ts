// src/lib/deploy-commands.ts
import { REST, Routes } from 'discord.js';
import { config } from '../config';
import logger from '../logger';
import fs from 'node:fs';
import path from 'node:path';

const commands = [];
const commandsPath = path.join(__dirname, '../commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'));

// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
for (const file of commandFiles) {
    // We need to dynamically import to get the data
    const { command } = await import(path.join(commandsPath, file));
    commands.push(command.data.toJSON());
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(config.TOKEN);

// and deploy your commands!
(async () => {
    try {
        logger.info(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data: any = await rest.put(
            Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
            { body: commands },
        );

        logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        logger.error(error, 'Failed to refresh application commands.');
    }
})();