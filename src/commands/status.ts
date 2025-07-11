// src/commands/status.ts
import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import type { Command } from '../types/command';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Shows which days in a range are archived or missing.') // Dialogue key: status.desc
        .addIntegerOption(option =>
            option.setName('start').setDescription('The starting day number.').setMinValue(1), // Dialogue key: status.option.start.desc
        )
        .addIntegerOption(option => option.setName('end').setDescription('The ending day number.').setMinValue(1)), // Dialogue key: status.option.end.desc
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.deferReply({ ephemeral: true });

        const start = interaction.options.getInteger('start') ?? 1;
        const maxDay = client.posts.getMaxDay();
        const end = interaction.options.getInteger('end') ?? maxDay ?? 1;

        if (end < start) {
            await interaction.editReply(client.dialogueService.get('status.fail.startAfterEnd'));
            return;
        }

        if (start > end) {
            await interaction.editReply(client.dialogueService.get('status.fail.startAfterEnd'));
            return;
        }

        // Get all archived days in the range
        const archivedDays: Set<number> = new Set();
        for (let day = start; day <= end; day++) {
            if (client.posts.findByDay(day)) {
                archivedDays.add(day);
            }
        }

        const DAYS_PER_PAGE = 25;
        const totalPages = Math.ceil((end - start + 1) / DAYS_PER_PAGE);

        const generateEmbed = (page: number) => {
            const pageStartDay = start + page * DAYS_PER_PAGE;
            const pageEndDay = Math.min(start + (page + 1) * DAYS_PER_PAGE - 1, end);
            const archivedInPage = new Set([...archivedDays].filter(day => day >= pageStartDay && day <= pageEndDay));

            const statuses: string[] = [];
            for (let day = pageStartDay; day <= pageEndDay; day++) {
                const status = archivedInPage.has(day) ? '✅' : '❌';
                statuses.push(client.dialogueService.get('status.embed.dayStatus', { day, status }));
            }

            const pageContent = statuses.join('\n') || client.dialogueService.get('status.embed.noData');

            return new EmbedBuilder()
                .setTitle(client.dialogueService.get('status.embed.title', { start, end }))
                .setDescription(pageContent)
                .setColor('#5865F2')
                .setFooter({ text: client.dialogueService.get('status.embed.footer', { page: page + 1, totalPages }) });
        };

        const generateButtons = (page: number) => {
            const row = new ActionRowBuilder<ButtonBuilder>();
            const prevButton = new ButtonBuilder()
                .setCustomId('prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0);
            const nextButton = new ButtonBuilder()
                .setCustomId('next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages - 1);
            row.addComponents(prevButton, nextButton);
            return [row];
        };

        if (totalPages === 1) {
            await interaction.editReply({ embeds: [generateEmbed(0)] });
        } else {
            let currentPage = 0;
            const reply = await interaction.editReply({
                embeds: [generateEmbed(currentPage)],
                components: generateButtons(currentPage),
            });

            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300_000, // 5 minutes
            });

            collector.on('collect', i => {
                void (async () => {
                    if (i.customId === 'prev' && currentPage > 0) {
                        currentPage--;
                    } else if (i.customId === 'next' && currentPage < totalPages - 1) {
                        currentPage++;
                    }

                    await i.update({
                        embeds: [generateEmbed(currentPage)],
                        components: generateButtons(currentPage),
                    });
                })();
            });

            collector.on('end', () => {
                void (async () => {
                    try {
                        await interaction.editReply({ components: [] });
                    } catch {
                        client.logger.warn('Failed to clear interaction components after timeout.');
                    }
                })();
            });
        }
    },
};