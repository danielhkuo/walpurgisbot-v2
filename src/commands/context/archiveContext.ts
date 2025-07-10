// src/commands/context/archiveContext.ts
import {
    ApplicationCommandType,
    ContextMenuCommandBuilder,
    ModalBuilder,
    PermissionFlagsBits,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';
import type { Client, MessageContextMenuCommandInteraction, ModalActionRowComponentBuilder } from 'discord.js';
import type { MessageContextMenuCommand } from '../../types/contextMenuCommand';
import { parseMessageContent } from '../../lib/archiveParser';
import type { CreatePostInput } from '../../types/database';

export const command: MessageContextMenuCommand = {
    data: new ContextMenuCommandBuilder()
        .setName('Manual Archive Post')
        .setType(ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction: MessageContextMenuCommandInteraction, client: Client) {
        const targetMessage = interaction.targetMessage;

        if (targetMessage.attachments.size === 0) {
            await interaction.reply({
                content: 'Error: The selected message has no attachments to archive.',
                ephemeral: true,
            });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`manual_archive_modal_${targetMessage.id}`)
            .setTitle('Manual Archive');

        const dayInput = new TextInputBuilder()
            .setCustomId('day_input')
            .setLabel('Day Number')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., 123')
            .setRequired(true)
            .setMinLength(1);

        // Intellisense: Attempt to parse the day from the message content.
        const parseResult = parseMessageContent(targetMessage.content);
        if (parseResult.detectedDays.length > 0) {
            // Pre-fill with the first detected day.
            dayInput.setValue(parseResult.detectedDays[0]?.toString() ?? '');
        }

        const actionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(dayInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);

        try {
            const modalSubmit = await interaction.awaitModalSubmit({
                time: 60_000, // 1 minute
                filter: i => i.customId === `manual_archive_modal_${targetMessage.id}`,
            });

            const dayString = modalSubmit.fields.getTextInputValue('day_input');
            const day = parseInt(dayString, 10);

            if (isNaN(day) || day < 1) {
                await modalSubmit.reply({
                    content: 'Error: Please provide a valid, positive day number.',
                    ephemeral: true,
                });
                return;
            }

            if (client.posts.findByDay(day)) {
                await modalSubmit.reply({
                    content: `Error: An archive for Day ${day} already exists.`,
                    ephemeral: true,
                });
                return;
            }

            const postData: CreatePostInput = {
                day,
                message_id: targetMessage.id,
                channel_id: targetMessage.channel.id,
                user_id: targetMessage.author.id,
                timestamp: Math.floor(targetMessage.createdTimestamp / 1000),
                mediaUrls: targetMessage.attachments.map(att => att.url),
            };

            const result = client.posts.createWithMedia(postData);

            if (result) {
                await modalSubmit.reply({
                    content: `✅ Successfully created an archive for Day ${day}.`,
                    ephemeral: true,
                });
            } else {
                await modalSubmit.reply({
                    content: 'An error occurred while creating the archive. Please check the logs.',
                    ephemeral: true,
                });
            }
        } catch (error) {
            // This catches the timeout from awaitModalSubmit. No reply is needed.
            client.logger.warn({ err: error }, 'Manual archive (context menu) modal timed out or failed.');
        }
    },
};