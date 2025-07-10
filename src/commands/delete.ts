// src/commands/delete.ts
import {
    SlashCommandBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType,
} from 'discord.js';
import type { ChatInputCommandInteraction, Client, ButtonInteraction } from 'discord.js';
import type { Command } from '../types/command';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription("Deletes a specific day's archive after confirmation.")
        .addIntegerOption(option =>
            option.setName('day').setDescription('The day number to delete.').setRequired(true).setMinValue(1),
        ),
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const day = interaction.options.getInteger('day', true);

        const existingPost = client.posts.findByDay(day);
        if (!existingPost) {
            await interaction.reply({ content: `Error: No archive found for Day ${day}.`, ephemeral: true });
            return;
        }

        const confirmButton = new ButtonBuilder()
            .setCustomId(`confirm_delete_${day}`)
            .setLabel('Yes, Delete')
            .setStyle(ButtonStyle.Danger);

        const cancelButton = new ButtonBuilder()
            .setCustomId(`cancel_delete_${day}`)
            .setLabel('No, Cancel')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

        const reply = await interaction.reply({
            content: `Are you sure you want to delete the archive for Day ${day}?`,
            components: [row],
            ephemeral: true,
        });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === interaction.user.id,
            time: 30_000, // 30 seconds
        });

        // NOTE: This in-memory collector is not robust against bot restarts. If the bot
        // restarts after the confirmation is sent but before a button is clicked, the
        // interaction will fail. Given the low frequency of this command, this is an
        // acceptable trade-off against the complexity of a persistent job queue.

        collector.on('collect', async (i: ButtonInteraction) => {
            if (i.customId === `confirm_delete_${day}`) {
                const success = client.posts.deleteByDay(day);
                if (success) {
                    await i.update({
                        content: `Deletion confirmed. The archive for Day ${day} has been removed.`,
                        components: [],
                    });
                } else {
                    await i.update({
                        content: `Error: Failed to delete the archive for Day ${day}. Check the logs.`,
                        components: [],
                    });
                }
            } else if (i.customId === `cancel_delete_${day}`) {
                await i.update({ content: 'Deletion cancelled.', components: [] });
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                await interaction.editReply({
                    content: 'Confirmation timed out. Deletion cancelled.',
                    components: [],
                });
            }
        });
    },
};