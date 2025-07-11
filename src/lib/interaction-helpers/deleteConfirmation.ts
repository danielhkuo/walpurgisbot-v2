// src/lib/interaction-helpers/deleteConfirmation.ts
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    type ChatInputCommandInteraction,
    type MessageContextMenuCommandInteraction,
    type Client,
    type MessageComponentInteraction,
} from 'discord.js';
import { createDeleteButtonId, parseId } from '../customIdManager';

type DeleteInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

/**
 * Shows a confirmation prompt with buttons for deleting an archive entry.
 * Handles the entire deletion flow with user confirmation.
 */
export async function presentDeleteConfirmation(
    interaction: DeleteInteraction,
    client: Client,
    messageId: string,
    affectedDays: number[],
) {
    const confirmButton = new ButtonBuilder()
        .setCustomId(createDeleteButtonId('confirm', messageId))
        .setLabel(client.dialogueService.get('delete.confirm.button.confirm'))
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId(createDeleteButtonId('cancel', messageId))
        .setLabel(client.dialogueService.get('delete.confirm.button.cancel'))
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    const reply = await interaction.reply({
        content: client.dialogueService.get('delete.confirm.prompt', {
            days: affectedDays.join(', '),
        }),
        components: [row],
        ephemeral: true,
    });

    const filter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
    const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
        filter,
    });

    collector.on('collect', i => {
        void (async () => {
            const { action } = parseId(i.customId);
            const collectedMessageId = messageId;

            if (action === 'confirm') {
                const success = client.posts.deleteByMessageId(collectedMessageId ?? '');
                if (success) {
                    await i.update({
                        content: client.dialogueService.get('delete.confirm.success', {
                            days: affectedDays.join(', '),
                        }),
                        components: [],
                    });
                } else {
                    await i.update({
                        content: client.dialogueService.get('delete.confirm.fail'),
                        components: [],
                    });
                }
            } else if (action === 'cancel') {
                await i.update({
                    content: client.dialogueService.get('delete.confirm.cancelled'),
                    components: [],
                });
            }
        })();
    });

    collector.on('end', collected => {
        void (async () => {
            if (collected.size === 0) {
                await interaction.editReply({ content: client.dialogueService.get('delete.confirm.timeout'), components: [] });
            }
        })();
    });
}