// src/commands/delete.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import type { Command } from '../types/command';
import type { Post } from '../types/database';
import { presentDeleteConfirmation } from '../lib/interaction-helpers/deleteConfirmation';

const MESSAGE_LINK_REGEX = /channels\/\d+\/\d+\/(\d+)/;

/**
 * Handles the logic for deleting an archive by its day number.
 * This finds the associated message and uses the shared confirmation flow.
 */
async function handleDeleteByDay(interaction: ChatInputCommandInteraction, client: Client) {
    const day = interaction.options.getInteger('day', true);

    const result = client.posts.findByDay(day);
    if (!result) {
        await interaction.reply({ content: `Error: No archive found for Day ${day}.`, ephemeral: true });
        return;
    }

    // Find all posts associated with this message to provide a full warning.
    const associatedPosts = client.posts.findPostsByMessageId(result.post.message_id);
    const affectedDays = associatedPosts.map(p => p.day);

    // Delegate to the shared helper to standardize deletion logic and UI.
    // This ensures that deleting "by day" behaves like deleting "by message",
    // preventing data inconsistencies if multiple days share one message.
    await presentDeleteConfirmation(interaction, client, result.post.message_id, affectedDays);
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

    // Delegate the entire confirmation flow to the shared helper function.
    await presentDeleteConfirmation(interaction, client, messageId, affectedDays);
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Deletes an archive entry after confirmation.')
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
                .setDescription('Deletes an archive entry using the original message link.')
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