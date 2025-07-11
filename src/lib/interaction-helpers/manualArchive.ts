// src/lib/interaction-helpers/manualArchive.ts
import {
    type ChatInputCommandInteraction,
    type Client,
    type Message,
    type MessageContextMenuCommandInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    type ModalActionRowComponentBuilder,
} from 'discord.js';
import { parseMessageContent } from '../archiveParser';
import type { CreatePostInput } from '../../types/database';

type ArchivableInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

/**
 * Presents a standardized modal for manually archiving a message.
 * Handles modal creation, submission, validation, and database interaction.
 * @param interaction The interaction that triggered the manual archive.
 * @param client The Discord client instance.
 * @param targetMessage The message to be archived.
 */
export async function presentManualArchiveModal(
    interaction: ArchivableInteraction,
    client: Client,
    targetMessage: Message,
) {
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

    // Attempt to pre-fill the day from the message content.
    const parseResult = parseMessageContent(targetMessage.content);
    if (parseResult.detectedDays.length > 0) {
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
        client.logger.warn({ err: error, messageId: targetMessage.id }, 'Manual archive modal timed out or failed.');
    }
}