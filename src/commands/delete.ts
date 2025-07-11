// src/commands/delete.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import type { Command } from '../types/command';
import type { Post } from '../types/database';
import { presentDeleteConfirmation } from '../lib/interaction-helpers/deleteConfirmation';

async function handleDeleteByDay(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    const day = interaction.options.getInteger('day', true);

    const result = client.posts.findByDay(day);
    if (!result) {
        await interaction.reply({
            content: client.dialogueService.get('delete.day.fail.notFound', { day }),
            ephemeral: true,
        });
        return;
    }

    const affectedDays = [day];
    await presentDeleteConfirmation(interaction, client, result.post.message_id, affectedDays);
}

/**
 * Handles the logic for deleting an archive by its original message link.
 */
async function handleDeleteByLink(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    const messageLink = interaction.options.getString('message_link', true);

    // Extract message ID using regex
    const match = messageLink.match(/\/(\d+)$/);

    if (!match || !match[1]) {
        await interaction.reply({
            content: client.dialogueService.get('delete.link.fail.invalid'),
            ephemeral: true,
        });
        return;
    }

    const messageId = match[1];

    const associatedPosts: Post[] = client.posts.findPostsByMessageId(messageId);
    if (associatedPosts.length === 0) {
        await interaction.reply({
            content: client.dialogueService.get('delete.link.fail.notFound'),
            ephemeral: true,
        });
        return;
    }

    const affectedDays = associatedPosts.map(post => post.day);
    await presentDeleteConfirmation(interaction, client, messageId, affectedDays);
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Deletes an archive entry after confirmation.') // Dialogue key: delete.desc
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('day')
                .setDescription("Deletes a specific day's archive using its number.") // Dialogue key: delete.day.desc
                .addIntegerOption(option =>
                    option.setName('day').setDescription('The day number to delete.').setRequired(true).setMinValue(1), // Dialogue key: delete.day.option.day.desc
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('link')
                .setDescription('Deletes an archive entry using the original message link.') // Dialogue key: delete.link.desc
                .addStringOption(option =>
                    option
                        .setName('message_link')
                        .setDescription('A link to the Discord message to delete from the archive.') // Dialogue key: delete.link.option.message_link.desc
                        .setRequired(true),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'day':
                await handleDeleteByDay(interaction, client);
                break;
            case 'link':
                await handleDeleteByLink(interaction, client);
                break;
        }
    },
};