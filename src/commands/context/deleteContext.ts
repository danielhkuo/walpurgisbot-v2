// src/commands/context/deleteContext.ts
import { ApplicationCommandType, ContextMenuCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Client, MessageContextMenuCommandInteraction } from 'discord.js';
import type { MessageContextMenuCommand } from '../../types/contextMenuCommand';
import type { Post } from '../../types/database';
import { presentDeleteConfirmation } from '../../lib/interaction-helpers/deleteConfirmation';

export const command: MessageContextMenuCommand = {
    data: new ContextMenuCommandBuilder()
        .setName('Delete Archive Entry') // Dialogue key: context.delete.name
        .setType(ApplicationCommandType.Message)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction: MessageContextMenuCommandInteraction, client: Client) {
        const messageId = interaction.targetMessage.id;
        const associatedPosts: Post[] = client.posts.findPostsByMessageId(messageId);

        if (associatedPosts.length === 0) {
            await interaction.reply({
                content: client.dialogueService.get('context.delete.fail.notRegistered'),
                ephemeral: true,
            });
            return;
        }

        const affectedDays = associatedPosts.map(post => post.day);
        await presentDeleteConfirmation(interaction, client, messageId, affectedDays);
    },
};