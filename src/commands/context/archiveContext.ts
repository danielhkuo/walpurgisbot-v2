// src/commands/context/archiveContext.ts
import { ApplicationCommandType, ContextMenuCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Client, MessageContextMenuCommandInteraction } from 'discord.js';
import type { MessageContextMenuCommand } from '../../types/contextMenuCommand';
import { presentManualArchiveModal } from '../../lib/interaction-helpers/manualArchive';

export const command: MessageContextMenuCommand = {
    data: new ContextMenuCommandBuilder()
        .setName('Manual Archive Post') // Dialogue key: context.archive.name
        .setType(ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction: MessageContextMenuCommandInteraction, client: Client) {
        return await presentManualArchiveModal(interaction, client, interaction.targetMessage);
    },
};