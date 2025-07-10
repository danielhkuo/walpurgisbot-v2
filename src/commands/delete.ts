// src/commands/delete.ts
import {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
    PermissionFlagsBits,
} from 'discord.js';
import type { ChatInputCommandInteraction, Client, ButtonInteraction } from 'discord.js';
import type { Command } from '../types/command';
import type { Post } from '../types/database';

const MESSAGE_LINK_REGEX = /channels\/\d+\/\d+\/(\d+)/;

/**
 * Handles the logic for deleting an archive by its day number.
 */
async function handleDeleteByDay(interaction: ChatInputCommandInteraction, client: Client) {
    const day = interaction.options.getInteger('day', true);

    const existingPost = client.posts.findByDay(day);
    if (!existingPost) {
        await interaction.reply({ content: `Error: No archive found for Day ${day}.`, ephemeral: true });
        return;
    }

    const confirmButton = new ButtonBuilder()
        .setCustomId(`confirm_delete_day_${day}`)
        .setLabel('Yes, Delete')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId(`cancel_delete_day_${day}`)
        .setLabel('No, Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

    const reply = await interaction.reply({
        content: `Are you sure you want to delete the archive for Day ${day}?`,
        components: [row],
        ephemeral: true,
    });

    const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: i => i.user.id === interaction.user.id,
        time: 30_000, // 30 seconds
    });

    collector.on('collect', async (i: ButtonInteraction) => {
        // Custom ID format: confirm_delete_day_{day_number}
        const collectedDay = parseInt(i.customId?.split('_')[3] ?? '0', 10);

        if (i.customId.startsWith('confirm_delete_day')) {
            const success = client.posts.deleteByDay(collectedDay);
            if (success) {
                await i.update({
                    content: `✅ Deletion confirmed. The archive for Day ${collectedDay} has been removed.`,
                    components: [],
                });
            } else {
                await i.update({
                    content: `❌ Error: Failed to delete the archive for Day ${collectedDay}. Check the logs.`,
                    components: [],
                });
            }
        } else if (i.customId.startsWith('cancel_delete_day')) {
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

/**
 * Handles the logic for deleting an archive by its original message link.
 */
async function handleDeleteByLink(interaction: ChatInputCommandInteraction, client: Client) {
    const messageLink = interaction.options.getString('message_link', true);
    const match = messageLink.match(MESSAGE_LINK_REGEX);

    if (!match || !match[1]) {
        await interaction.reply({
            content: '❌ Invalid message link format. Please provide a valid Discord message link.',
            ephemeral: true,
        });
        return;
    }
    const messageId = match[1];

    const associatedPosts: Post[] = client.posts.findPostsByMessageId(messageId);
    if (associatedPosts.length === 0) {
        await interaction.reply({ content: 'No archive entry is associated with that message.', ephemeral: true });
        return;
    }

    const affectedDays = associatedPosts.map(p => p.day);

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
            const success = client.posts.deleteByMessageId(collectedMessageId);
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

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription("Deletes an archive entry after confirmation.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('day')
                .setDescription("Deletes a specific day's archive using its number.")
                .addIntegerOption(option =>
                    option.setName('day').setDescription('The day number to delete.').setRequired(true).setMinValue(1),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('link')
                .setDescription("Deletes an archive entry using the original message link.")
                .addStringOption(option =>
                    option
                        .setName('message_link')
                        .setDescription('A link to the Discord message to delete from the archive.')
                        .setRequired(true),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'day') {
            await handleDeleteByDay(interaction, client);
        } else if (subcommand === 'link') {
            await handleDeleteByLink(interaction, client);
        }
    },
};