// src/events/interactionCreate.ts
import { Events, type Interaction, type Client, GuildMemberRoleManager } from 'discord.js';
import type { Event } from '../types/event';
import { config } from '../config';

// Helper function to check for admin role
// This remains for non-application-command interactions (buttons, modals)
function isBotAdmin(interaction: Interaction): boolean {
    if (!interaction.member || !interaction.member.roles) return false;
    const roles = interaction.member.roles as GuildMemberRoleManager;
    return roles.cache.has(config.ADMIN_ROLE_ID);
}

export const event: Event<Events.InteractionCreate> = {
    name: Events.InteractionCreate,
    async execute(client: Client, interaction: Interaction) {
        if (interaction.isButton() || interaction.isModalSubmit()) {
            const prefix = interaction.customId.split('_')[0];
            const archiveActions = ['force', 'confirm', 'ignore', 'add', 'submit'];
            if (prefix && archiveActions.includes(prefix)) {
                if (!isBotAdmin(interaction)) {
                    await interaction.reply({ content: 'You do not have permission to perform this action.', ephemeral: true });
                    return;
                }
                
                if(interaction.isButton()) {
                    await client.archiveSessionManager.handleInteraction(interaction);
                }
                if(interaction.isModalSubmit()) {
                    await client.archiveSessionManager.handleModalSubmit(interaction);
                }
                return; // Stop further processing
            }
        }

        // --- Command and Autocomplete Handling ---
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
                // The `isBotAdmin` check for slash commands like 'delete' is no longer needed here.
                // Permissions are now handled declaratively via setDefaultMemberPermissions.
                // We keep the check for any commands that might still rely on it.
                if (['settings', 'manual-archive'].includes(command.data.name)) {
                    if (!isBotAdmin(interaction)) {
                         await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                         return;
                    }
                }
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