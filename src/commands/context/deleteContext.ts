// src/commands/context/deleteContext.ts
import { ApplicationCommandType, ContextMenuCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Client, MessageContextMenuCommandInteraction } from 'discord.js';
import type { MessageContextMenuCommand } from '../../types/contextMenuCommand';
import type { Post } from '../../types/database';
import { presentDeleteConfirmation } from '../../lib/interaction-helpers/deleteConfirmation';

export const command: MessageContextMenuCommand = {
    data: new ContextMenuCommandBuilder()
        .setName('Delete Archive Entry')
        .setType(ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction: MessageContextMenuCommandInteraction, client: Client) {
        const targetMessage = interaction.targetMessage;
        const associatedPosts: Post[] = client.posts.findPostsByMessageId(targetMessage.id);

        if (associatedPosts.length === 0) {
            await interaction.reply({
                content: 'This message is not registered as an archive entry.',
                ephemeral: true,
            });
            return;
        }

        const affectedDays = associatedPosts.map(p => p.day);

        // Delegate the entire confirmation flow to the shared helper function.
        await presentDeleteConfirmation(interaction, client, targetMessage.id, affectedDays);
    },
};