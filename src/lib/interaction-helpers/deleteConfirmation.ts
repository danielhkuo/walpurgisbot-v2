// src/lib/interaction-helpers/deleteConfirmation.ts
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type Client,
    type MessageContextMenuCommandInteraction,
} from 'discord.js';

type DeletableInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

/**
 * Presents a standardized, ephemeral confirmation prompt for deleting archive entries.
 * Handles the button collector and resulting database operation.
 * @param interaction The interaction that triggered the deletion.
 * @param client The Discord client instance.
 * @param messageId The ID of the message whose archive entries will be deleted.
 * @param affectedDays An array of day numbers that will be deleted.
 */
export async function presentDeleteConfirmation(
    interaction: DeletableInteraction,
    client: Client,
    messageId: string,
    affectedDays: number[],
) {
    const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_delete_link_${messageId}`)
        .setLabel('Yes, Delete')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_delete_link_${messageId}`)
        .setLabel('No, Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    const reply = await interaction.reply({
        content: `This message is associated with Day(s) **${affectedDays.join(
            ', ',
        )}**. Are you sure you want to delete all related archive entries?`,
        components: [row],
        ephemeral: true,
    });

    const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 30_000, // 30 seconds
    });

    collector.on('collect', async (i: ButtonInteraction) => {
        // Custom ID format: confirm_delete_link_{message_id}
        const collectedMessageId = i.customId.split('_')[3];

        if (i.customId.startsWith('confirm_delete_link')) {
            const success = client.posts.deleteByMessageId(collectedMessageId ?? '');
            if (success) {
                await i.update({
                    content: `✅ Deletion confirmed. The archive entries for Day(s) **${affectedDays.join(
                        ', ',
                    )}** have been removed.`,
                    components: [],
                });
            } else {
                await i.update({
                    content: '❌ Error: Failed to delete the archive entries. Check the logs.',
                    components: [],
                });
            }
        } else if (i.customId.startsWith('cancel_delete_link')) {
            await i.update({ content: 'Deletion cancelled.', components: [] });
        }
    });

    collector.on('end', async collected => {
        if (collected.size === 0) {
            await interaction.editReply({
                content: 'Confirmation timed out. Deletion cancelled.',
                components: [],
            });
        }
    });
}