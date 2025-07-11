// src/events/interactionCreate.ts
import type { Client, Interaction, PermissionsBitField } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import type { Event } from '../types/event';
import { parseId } from '../lib/customIdManager';

const hasAdminPermissions = (interaction: { memberPermissions?: PermissionsBitField | null }): boolean => {
    return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
};

export const event: Event<'interactionCreate'> = {
    name: 'interactionCreate',
    async execute(client: Client, interaction: Interaction) {
        // --- Component Interaction Handling (Buttons, Modals, etc.) ---
        if (interaction.isButton() || interaction.isModalSubmit()) {
            const { namespace } = parseId(interaction.customId);

            // Check for prefixes used by the ArchiveSessionManager
            if (namespace === 'archive') {
                // All session-managed interactions require admin privileges.
                if (!hasAdminPermissions(interaction)) {
                    await interaction.reply({
                        content: client.dialogueService.get('error.noPermission'),
                        ephemeral: true,
                    });
                    return;
                }

                if (interaction.isButton()) {
                    await client.archiveSessionManager.handleInteraction(interaction);
                } else if (interaction.isModalSubmit()) {
                    await client.archiveSessionManager.handleModalSubmit(interaction);
                }
                return; // These interactions are fully handled by the session manager.
            }
            // Note: Command-specific button collectors (like for /delete) will fall through
            // and be handled by the collector in their respective command files.
        }

        // --- Application Command Handling ---
        if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) {
                client.logger.warn({ commandName: interaction.commandName }, 'No command found.');
                if (interaction.isChatInputCommand()) {
                    await interaction.reply({
                        content: client.dialogueService.get('error.command.notFound', {
                            commandName: interaction.commandName,
                        }),
                        ephemeral: true,
                    });
                }
                return;
            }

            try {
                // Command permissions are handled declaratively via `setDefaultMemberPermissions`.
                // No imperative checks are needed here.
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
                }
            } catch (error) {
                client.logger.error({ err: error, commandName: interaction.commandName }, 'Error executing command.');
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: client.dialogueService.get('error.command.execution'),
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        content: client.dialogueService.get('error.command.execution'),
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