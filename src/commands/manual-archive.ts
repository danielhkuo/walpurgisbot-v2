// src/commands/manual-archive.ts
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import type { Command } from '../types/command';
import { presentManualArchiveModal } from '../lib/interaction-helpers/manualArchive';
import type { Message } from 'discord.js';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('manual-archive')
        .setDescription('Manually archives a post using its message ID.') // Dialogue key: manualArchive.desc
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addStringOption(option =>
            option
                .setName('message_id')
                .setDescription('The ID of the message to archive.') // Dialogue key: manualArchive.option.message_id.desc
                .setRequired(true),
        ),
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const messageId = interaction.options.getString('message_id', true);

        if (!interaction.channel) {
            await interaction.reply({
                content: client.dialogueService.get('manualArchive.fail.noChannel'),
                ephemeral: true,
            });
            return;
        }

        let message: Message;
        try {
            message = await interaction.channel.messages.fetch(messageId);
        } catch {
            await interaction.reply({
                content: client.dialogueService.get('manualArchive.fail.notFound'),
                ephemeral: true,
            });
            return;
        }

        await presentManualArchiveModal(interaction, client, message);
    },
};