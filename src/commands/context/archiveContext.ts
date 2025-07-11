// src/commands/context/archiveContext.ts
import { ApplicationCommandType, ContextMenuCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Client, MessageContextMenuCommandInteraction } from 'discord.js';
import type { MessageContextMenuCommand } from '../../types/contextMenuCommand';
import { presentManualArchiveModal } from '../../lib/interaction-helpers/manualArchive';

export const command: MessageContextMenuCommand = {
    data: new ContextMenuCommandBuilder()
        .setName('Manual Archive Post')
        .setType(ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction: MessageContextMenuCommandInteraction, client: Client) {
        const targetMessage = interaction.targetMessage;

        // Delegate all logic to the shared modal presenter.
        await presentManualArchiveModal(interaction, client, targetMessage);
    },
};