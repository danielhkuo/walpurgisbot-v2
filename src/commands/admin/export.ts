// src/commands/admin/export.ts
import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { promises as fsPromises, createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';
import type { Command } from '../../types/command';

// Discord's file size limit is 25MB. We'll use 24MB as a safe buffer.
const MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024;

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('export')
        .setDescription('Exports the entire archive database to a JSON file.') // Dialogue key: export.desc
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.reply({
            content: client.dialogueService.get('export.generating'),
            ephemeral: true,
        });

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
                // The generator already returns the post with a `media` array of strings.
                const line = JSON.stringify(post, null, 2);
                writeStream.write(line);
                isFirst = false;
            }
            if (!isFirst) {
                writeStream.write('\n');
            }
            writeStream.write(']\n');

            writeStream.end();
            await finished(writeStream);

            if (isFirst) {
                await interaction.editReply({
                    content: client.dialogueService.get('export.empty'),
                });
                return;
            }

            const stats = await fsPromises.stat(tempFilePath);
            if (stats.size > MAX_FILE_SIZE_BYTES) {
                await interaction.editReply({
                    content: client.dialogueService.get('export.fail.tooLarge'),
                });
                return;
            }

            const attachment = new AttachmentBuilder(tempFilePath, {
                name: `walpurgis-export-${new Date().toISOString().split('T')[0]}.json`,
            });

            try {
                await interaction.user.send({
                    content: client.dialogueService.get('export.dm.content'),
                    files: [attachment],
                });
                await interaction.editReply({
                    content: client.dialogueService.get('export.success.dm'),
                });
            } catch (dmError: unknown) {
                client.logger.warn({ err: dmError, userId: interaction.user.id }, 'Failed to send DM for export.');
                await interaction.editReply({ content: client.dialogueService.get('export.fail.dm') });
            }
        } catch (error: unknown) {
            client.logger.error({ err: error }, 'An error occurred during database export.');
            await interaction.editReply({ content: client.dialogueService.get('error.export.generic') });
        } finally {
            // Ensure temporary file is always cleaned up
            await fsPromises.unlink(tempFilePath).catch((err: unknown) => {
                client.logger.warn({ err, tempFilePath }, 'Failed to clean up temporary export file.');
            });
        }
    },
};