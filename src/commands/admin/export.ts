// src/commands/admin/export.ts
import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { promises as fsPromises, createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

        const tempFilePath = path.join(os.tmpdir(), `walpurgis-export-${Date.now()}.json`);

        try {
            const writeStream = createWriteStream(tempFilePath, 'utf-8');
            const postGenerator = client.posts.findAllWithMedia();

            writeStream.write('[\n');
            let isFirst = true;
            for (const post of postGenerator) {
                if (!isFirst) {
                    writeStream.write(',\n');
                }
                const line = JSON.stringify(post, null, 2);
                writeStream.write(line);
                isFirst = false;
            }
            // Add a final newline if any posts were written
            if (!isFirst) {
                writeStream.write('\n');
            }
            writeStream.write(']\n');

            // Wait for the stream to finish writing to the file
            await new Promise((resolve, reject) => {
                writeStream.on('finish', () => resolve(undefined));
                writeStream.on('error', reject);
                writeStream.end();
            });

            // If isFirst is still true, the loop never ran.
            if (isFirst) {
                await interaction.editReply({
                    content: 'ℹ️ The archive is empty. Nothing to export.',
                });
                return; // Early return, cleanup will still run
            }

            const stats = await fsPromises.stat(tempFilePath);
            if (stats.size > MAX_FILE_SIZE_BYTES) {
                await interaction.editReply({
                    content: `❌ **Export Failed:** The database is too large to send as a single file via Discord (over 24MB). Please contact the bot developer for a manual export.`,
                });
                return;
            }

            const attachment = new AttachmentBuilder(tempFilePath, {
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
        } finally {
            // Ensure temporary file is always cleaned up
            await fsPromises.unlink(tempFilePath).catch(err => {
                client.logger.warn({ err }, `Failed to clean up temporary export file: ${tempFilePath}`);
            });
        }
    },
};