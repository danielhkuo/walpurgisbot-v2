// src/commands/admin/export.ts
import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import type { Command } from '../../types/command';

// Discord's file size limit is 25MB. We'll use 24MB as a safe buffer.
const MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024;

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('export')
        .setDescription('Exports the entire archive database to a JSON file.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.reply({ content: '⏳ Generating database export... this may take a moment.', ephemeral: true });

        try {
            const allPosts = client.posts.findAllWithMedia();

            if (allPosts.length === 0) {
                await interaction.editReply({
                    content: 'ℹ️ The archive is empty. Nothing to export.',
                });
                return;
            }

            // The repository method already returns the data in the desired nested structure.
            const jsonString = JSON.stringify(allPosts, null, 2); // Pretty-print the JSON
            const buffer = Buffer.from(jsonString, 'utf-8');

            if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
                await interaction.editReply({
                    content: `❌ **Export Failed:** The database is too large to send as a single file via Discord (over 24MB). Please contact the bot developer for a manual export.`,
                });
                return;
            }

            const attachment = new AttachmentBuilder(buffer, {
                name: `walpurgis-export-${new Date().toISOString().split('T')[0]}.json`,
            });

            try {
                await interaction.user.send({
                    content: 'Here is your database export:',
                    files: [attachment],
                });
                await interaction.editReply({
                    content: '✅ The database export has been sent to your DMs.',
                });
            } catch (dmError) {
                client.logger.warn({ err: dmError, userId: interaction.user.id }, 'Failed to send DM for export.');
                await interaction.editReply({
                    content:
                        '❌ **Could not send DM.** Please check your privacy settings to allow DMs from this server, then try again.',
                });
            }
        } catch (error) {
            client.logger.error({ err: error }, 'An error occurred during database export.');
            await interaction.editReply({
                content: 'An unexpected error occurred while generating the export. Please check the logs.',
            });
        }
    },
};