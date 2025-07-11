// src/lib/interaction-helpers/manualArchive.ts
import {
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ChatInputCommandInteraction,
    type Client,
    type Message,
    type MessageContextMenuCommandInteraction,
} from 'discord.js';

type ArchiveInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

/**
 * Shows a modal to collect the day number for manual archiving.
 * Handles the entire archiving flow including validation and database updates.
 */
export async function presentManualArchiveModal(
    interaction: ArchiveInteraction,
    client: Client,
    targetMessage: Message,
) {
    if (targetMessage.attachments.size === 0) {
        await interaction.reply({
            content: client.dialogueService.get('manualArchive.modal.fail.noAttachments'),
            ephemeral: true,
        });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(`manual_archive_modal_${targetMessage.id}`)
        .setTitle(client.dialogueService.get('manualArchive.modal.title'));

    const dayInput = new TextInputBuilder()
        .setCustomId('day_input')
        .setLabel(client.dialogueService.get('manualArchive.modal.day.label'))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(client.dialogueService.get('manualArchive.modal.day.placeholder'))
        .setRequired(true)
        .setMinLength(1);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(dayInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);

    try {
        const modalSubmit = await interaction.awaitModalSubmit({
            time: 5 * 60 * 1000, // 5 minutes
            filter: i => i.user.id === interaction.user.id && i.customId === modal.data.custom_id,
        });

        const dayString = modalSubmit.fields.getTextInputValue('day_input');
        const day = parseInt(dayString, 10);

        if (isNaN(day) || day < 1) {
            await modalSubmit.reply({
                content: client.dialogueService.get('manualArchive.reply.fail.invalidDay'),
                ephemeral: true,
            });
            return;
        }

        if (client.posts.findByDay(day)) {
            await modalSubmit.reply({
                content: client.dialogueService.get('manualArchive.reply.fail.exists', { day }),
                ephemeral: true,
            });
            return;
        }

        const mediaUrls = targetMessage.attachments.map(attachment => attachment.url);
        const result = client.posts.createWithMedia({
            day,
            message_id: targetMessage.id,
            channel_id: targetMessage.channel.id,
            user_id: targetMessage.author.id,
            timestamp: Math.floor(targetMessage.createdTimestamp / 1000),
            mediaUrls,
        });

        if (result) {
            await modalSubmit.reply({
                content: client.dialogueService.get('manualArchive.reply.success', { day }),
                ephemeral: true,
            });
        } else {
            await modalSubmit.reply({ content: client.dialogueService.get('manualArchive.reply.fail.generic'), ephemeral: true });
        }
    } catch (error) {
        // This catches the timeout from awaitModalSubmit. No reply is needed.
        client.logger.warn({ err: error }, 'Manual archive modal timed out or was cancelled.');
    }
}