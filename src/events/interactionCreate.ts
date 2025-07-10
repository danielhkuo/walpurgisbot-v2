// src/events/interactionCreate.ts
import { Events, type Interaction, type Client } from 'discord.js';
import type { Event } from '../types/event';

export const event: Event<Events.InteractionCreate> = {
    name: Events.InteractionCreate,
    async execute(client: Client, interaction: Interaction) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
            client.logger.warn({ commandName: interaction.commandName }, 'No command found.');
            await interaction.reply({
                content: `No command matching \`/${interaction.commandName}\` was found.`,
                ephemeral: true,
            });
            return;
        }

        try {
            await command.execute(interaction, client);
        } catch (error) {
            client.logger.error({ err: error, commandName: interaction.commandName }, 'Error executing command.');
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) {
            client.logger.warn({ commandName: interaction.commandName }, 'No autocomplete handler found for command.');
            return;
        }
        try {
            await command.autocomplete(interaction);
        } catch (error) {
            client.logger.error({ err: error, commandName: interaction.commandName }, 'Error in autocomplete handler.');
        }
    }
},
};