// src/commands/manual-archive.ts
import {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction, Client, ModalActionRowComponentBuilder } from 'discord.js';
import type { Command } from '../types/command';
import type { CreatePostInput } from '../types/database';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('manual-archive')
        .setDescription('Manually archives a post using its message ID.')
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
            await interaction.reply({ content: 'Error: Could not find a message with that ID in this channel.', ephemeral: true });
            return;
        }

        if (message.attachments.size === 0) {
            await interaction.reply({ content: 'Error: The specified message has no attachments to archive.', ephemeral: true });
            return;
        }

        const modal = new ModalBuilder().setCustomId(`manual_archive_modal_${messageId}`).setTitle('Manual Archive');

        const dayInput = new TextInputBuilder()
            .setCustomId('day_input')
            .setLabel('Day Number')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 123')
            .setRequired(true)
            .setMinLength(1);

        const actionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(dayInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);

        try {
            const modalSubmit = await interaction.awaitModalSubmit({
                time: 60_000, // 1 minute
                filter: i => i.customId === `manual_archive_modal_${messageId}`,
            });

            const dayString = modalSubmit.fields.getTextInputValue('day_input');
            const day = parseInt(dayString, 10);

            if (isNaN(day) || day < 1) {
                await modalSubmit.reply({ content: 'Error: Please provide a valid, positive day number.', ephemeral: true });
                return;
            }

            if (client.posts.findByDay(day)) {
                await modalSubmit.reply({ content: `Error: An archive for Day ${day} already exists.`, ephemeral: true });
                return;
            }

            const postData: CreatePostInput = {
                day,
                message_id: message.id,
                channel_id: message.channel.id,
                user_id: message.author.id,
                timestamp: Math.floor(message.createdTimestamp / 1000),
                mediaUrls: message.attachments.map(att => att.url),
            };

            const result = client.posts.createWithMedia(postData);

            if (result) {
                await modalSubmit.reply({ content: `Successfully created an archive for Day ${day}.`, ephemeral: true });
            } else {
                await modalSubmit.reply({ content: 'An error occurred while creating the archive. Please check the logs.', ephemeral: true });
            }
        } catch (error) {
            // This catches the timeout from awaitModalSubmit
            client.logger.warn({ err: error }, 'Manual archive modal submission timed out or failed.');
        }
    },
};