// src/commands/admin/import.ts
// Implements the /import command for administrators.
// This command allows for the bulk import of archive data from a JSON file,
// supporting both V1 and V2 export formats.

import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import { ZodError } from 'zod';
import type { Command } from '../../types/command';
import { ImportFileSchema, type ImportPost } from '../../types/import';

// Discord's file size limit is 25MB. We'll use 24MB as a safe buffer.
const MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024;

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('import')
        .setDescription('Imports posts from a V1 or V2 JSON export file.') // Dialogue key: import.desc
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addAttachmentOption(option =>
            option
                .setName('attachment')
                .setDescription('The JSON export file to import.') // Dialogue key: import.option.attachment.desc
                .setRequired(true),
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.reply({
            content: client.dialogueService.get('import.processing'),
            ephemeral: true,
        });

        const attachment = interaction.options.getAttachment('attachment', true);

        // 1. Pre-flight Validation
        if (!attachment.contentType?.includes('application/json')) {
            await interaction.editReply({
                content: client.dialogueService.get('import.fail.notJson'),
            });
            return;
        }

        if (attachment.size > MAX_FILE_SIZE_BYTES) {
            await interaction.editReply({
                content: client.dialogueService.get('import.fail.tooLarge'),
            });
            return;
        }

        // 2. Download and Parse JSON
        let jsonData: unknown;
        try {
            const response = await fetch(attachment.url);
            jsonData = await response.json();
        } catch (error: unknown) {
            client.logger.error({ err: error }, 'Failed to download or parse JSON file for import.');
            await interaction.editReply({
                content: client.dialogueService.get('import.fail.parse'),
            });
            return;
        }

        // 3. Validate Data Structure and Execute Import
        try {
            // --- Restored Zod Validation ---
            const validatedData = ImportFileSchema.parse(jsonData) as ImportPost[];

            // --- Restored Transactional Import ---
            const result = client.posts.importFromJson(validatedData);

            // 5. Report Success
            await interaction.editReply({
                content: client.dialogueService.get('import.success', {
                    importedCount: result.importedCount,
                    skippedCount: result.skippedCount,
                    total: validatedData.length,
                }),
            });
        } catch (error: unknown) {
            if (error instanceof ZodError) {
                // Provide a more user-friendly error from Zod's validation
                const firstError = error.errors[0];
                const path = firstError?.path.join('.') ?? 'file';
                const message = firstError?.message ?? 'unknown validation error';
                client.logger.warn({ zodError: error.format() }, 'Import validation failed.');
                await interaction.editReply({
                    content: client.dialogueService.get('import.fail.invalidFormat', { path, message }),
                });
            } else {
                client.logger.error({ err: error }, 'An unexpected error occurred during database import transaction.');
                await interaction.editReply({
                    content: client.dialogueService.get('import.fail.database'),
                });
            }
        }
    },
};