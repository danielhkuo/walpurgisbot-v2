/**
 * @fileoverview Implements the /import command for administrators.
 * This command allows for the bulk import of archive data from a JSON file,
 * supporting both V1 and V2 export formats.
 */

import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    type ChatInputCommandInteraction,
    type Client,
  } from 'discord.js';
  import { ZodError } from 'zod';
  import type { Command } from '../../types/command';
  import { ImportFileSchema, type ImportPost } from '../../types/import';
  
  // Discord's file size limit is 25MB. We'll use 24MB as a safe buffer.
  const MAX_FILE_SIZE_BYTES = 24 * 1024 * 1024;
  
  export const command: Command = {
    data: new SlashCommandBuilder()
      .setName('import')
      .setDescription('Imports posts from a V1 or V2 JSON export file.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false)
      .addAttachmentOption(option =>
        option
          .setName('attachment')
          .setDescription('The JSON export file to import.')
          .setRequired(true),
      ),
  
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
      await interaction.reply({
        content: '⏳ Validating and processing your import file...',
        ephemeral: true,
      });
  
      const attachment = interaction.options.getAttachment('attachment', true);
  
      // 1. Pre-flight Validation
      if (!attachment.contentType?.includes('application/json')) {
        await interaction.editReply({
          content: '❌ **Import Failed:** Please provide a valid JSON file (`.json`).',
        });
        return;
      }
  
      if (attachment.size > MAX_FILE_SIZE_BYTES) {
        await interaction.editReply({
          content: `❌ **Import Failed:** The file is too large (over 24MB).`,
        });
        return;
      }
  
      // 2. Download and Parse JSON
      let jsonData: unknown;
      try {
        const response = await fetch(attachment.url);
        jsonData = await response.json();
      } catch (error) {
        client.logger.error(
          { err: error },
          'Failed to download or parse JSON file for import.',
        );
        await interaction.editReply({
          content:
            '❌ **Import Failed:** Could not download or parse the file. Ensure it is valid JSON.',
        });
        return;
      }
  
      // 3. Validate Data Structure and Execute Import
      try {
        const validatedData = ImportFileSchema.parse(jsonData) as ImportPost[];
  
        // 4. Delegate to the transactional repository method
        const result = client.posts.importFromJson(validatedData);
  
        // 5. Report Success
        await interaction.editReply({
          content: `✅ **Import Complete!**\n- **Posts Imported:** \`${result.importedCount}\`\n- **Posts Skipped (Already Existed):** \`${result.skippedCount}\`\n- **Total Posts Processed:** \`${validatedData.length}\``,
        });
      } catch (error) {
        if (error instanceof ZodError) {
          // Provide a more user-friendly error from Zod's validation
          const firstError = error.errors[0];
          const path = firstError?.path.join('.') ?? '';
          const message = firstError?.message ?? '';
          client.logger.warn(
            { zodError: error.format() },
            'Import validation failed.',
          );
          await interaction.editReply({
            content: `❌ **Invalid File Format:** The file is not a valid export.\n**Error:** At entry \`${path}\`: ${message}`,
          });
        } else {
          client.logger.error(
            { err: error },
            'An unexpected error occurred during database import transaction.',
          );
          await interaction.editReply({
            content:
              '❌ **Import Failed:** An unexpected error occurred while writing to the database. The database has not been changed. Please check the logs.',
          });
        }
      }
    },
  };