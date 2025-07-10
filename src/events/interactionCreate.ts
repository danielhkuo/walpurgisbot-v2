// src/events/interactionCreate.ts
import { Events, type Interaction, type Client, GuildMemberRoleManager } from 'discord.js';
import type { Event } from '../types/event';
import { config } from '../config';

// Helper function to check for admin role
function isBotAdmin(interaction: Interaction): boolean {
    if (!interaction.member || !interaction.member.roles) return false;
    const roles = interaction.member.roles as GuildMemberRoleManager;
    return roles.cache.has(config.ADMIN_ROLE_ID);
}

export const event: Event<Events.InteractionCreate> = {
    name: Events.InteractionCreate,
    async execute(client: Client, interaction: Interaction) {
        // --- Component Interaction Handling (Buttons, Modals, etc.) ---
        if (interaction.isButton() || interaction.isModalSubmit()) {
            const prefix = interaction.customId.split('_')[0];
            const archiveActions = ['force', 'confirm', 'ignore', 'add', 'submit', 'delete'];
            if (prefix && archiveActions.includes(prefix)) {
                if (!isBotAdmin(interaction)) {
                    await interaction.reply({
                        content: 'You do not have permission to perform this action.',
                        ephemeral: true,
                    });
                    return;
                }

                if (interaction.isButton()) {
                    // Specific logic for delete buttons which are handled by the command itself
                    if (!interaction.customId.startsWith('delete')) {
                        await client.archiveSessionManager.handleInteraction(interaction);
                    }
                }
                if (interaction.isModalSubmit()) {
                    await client.archiveSessionManager.handleModalSubmit(interaction);
                }
                // We return here for session-managed interactions, but let command-based collectors proceed.
                if (!interaction.customId.startsWith('delete')) {
                    return;
                }
            }
        }

        // --- Application Command Handling ---
        if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                client.logger.warn({ commandName: interaction.commandName }, 'No command found.');
                // Context menus can't be "mistyped", so no reply is necessary.
                if (interaction.isChatInputCommand()) {
                    await interaction.reply({
                        content: `No command matching \`/${interaction.commandName}\` was found.`,
                        ephemeral: true,
                    });
                }
                return;
            }

            try {
                // Declarative permissions (`setDefaultMemberPermissions`) are the primary check.
                // This is a fallback/belt-and-suspenders for commands without it.
                if (['settings', 'manual-archive'].includes(command.data.name)) {
                    if (!isBotAdmin(interaction)) {
                        await interaction.reply({
                            content: 'You do not have permission to use this command.',
                            ephemeral: true,
                        });
                        return;
                    }
                }

                // Type-safe command execution
                if (interaction.isChatInputCommand() && 'description' in command.data) {
                    await (command as import('../types/command').Command).execute(interaction, client);
                } else if (interaction.isMessageContextMenuCommand() && !('description' in command.data)) {
                    await (command as import('../types/contextMenuCommand').MessageContextMenuCommand).execute(
                        interaction,
                        client,
                    );
                } else {
                    client.logger.warn(
                        { commandName: interaction.commandName, interactionType: interaction.type },
                        'Command and interaction type mismatch.',
                    );
                    // Optionally reply to the user
                }
            } catch (error) {
                client.logger.error({ err: error, commandName: interaction.commandName }, 'Error executing command.');
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: 'There was an error while executing this command!',
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        content: 'There was an error while executing this command!',
                        ephemeral: true,
                    });
                }
            }
        } else if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                client.logger.warn({ commandName: interaction.commandName }, 'No autocomplete handler for command.');
                return;
            }
            // Ensure the command is a slash command with an autocomplete handler
            if ('autocomplete' in command && command.autocomplete) {
                try {
                    await command.autocomplete(interaction);
                } catch (error) {
                    client.logger.error({ err: error, commandName: interaction.commandName }, 'Error in autocomplete handler.');
                }
            }
        }
    },
};