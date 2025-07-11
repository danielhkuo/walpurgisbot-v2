// src/commands/manual-archive.ts
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import type { Command } from '../types/command';
import { presentManualArchiveModal } from '../lib/interaction-helpers/manualArchive';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('manual-archive')
        .setDescription('Manually archives a post using its message ID.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('message_id').setDescription('The ID of the message to archive.').setRequired(true),
        ),
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const messageId = interaction.options.getString('message_id', true);

        if (!interaction.channel) {
            await interaction.reply({ content: 'This command must be run in a channel.', ephemeral: true });
            return;
        }

        let message;
        try {
            message = await interaction.channel.messages.fetch(messageId);
        } catch (error) {
            await interaction.reply({
                content: 'Error: Could not find a message with that ID in this channel.',
                ephemeral: true,
            });
            return;
        }

        // Delegate all further logic to the shared modal presenter.
        await presentManualArchiveModal(interaction, client, message);
    },
};