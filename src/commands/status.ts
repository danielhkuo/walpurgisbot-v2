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

const PAGE_SIZE = 20;

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Shows which days in a range are archived or missing.')
        .addIntegerOption(option =>
            option.setName('start').setDescription('The starting day number.').setMinValue(1),
        )
        .addIntegerOption(option => option.setName('end').setDescription('The ending day number.').setMinValue(1)),
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        await interaction.deferReply({ ephemeral: true });

        let start = interaction.options.getInteger('start') ?? 1;
        let end = interaction.options.getInteger('end');

        if (!end) {
            end = client.posts.getMaxDay() ?? start;
        }

        if (start > end) {
            await interaction.editReply('Error: The start day must be less than or equal to the end day.');
            return;
        }

        const archivedDays = new Set(client.posts.getArchivedDaysInRange(start, end));

        const statuses: string[] = [];
        for (let day = start; day <= end; day++) {
            const status = archivedDays.has(day) ? '✅' : '❌';
            statuses.push(`Day ${day}: ${status}`);
        }

        const totalPages = Math.ceil(statuses.length / PAGE_SIZE);
        let currentPage = 0;

        const generateEmbed = (page: number) => {
            const pageStart = page * PAGE_SIZE;
            const pageEnd = pageStart + PAGE_SIZE;
            const pageContent = statuses.slice(pageStart, pageEnd).join('\n') || 'No data for this range.';

            return new EmbedBuilder()
                .setTitle(`Archive Status: Days ${start} - ${end}`)
                .setDescription(pageContent)
                .setColor('#5865F2')
                .setFooter({ text: `Page ${page + 1} of ${totalPages}` });
        };

        const generateButtons = (page: number) => {
            return new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId('first')
                    .setLabel('⏮️ First')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('prev')
                    .setLabel('◀️ Prev')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page >= totalPages - 1),
                new ButtonBuilder()
                    .setCustomId('last')
                    .setLabel('Last ⏭️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(page >= totalPages - 1),
            );
        };

        const reply = await interaction.editReply({
            embeds: [generateEmbed(currentPage)],
            components: [generateButtons(currentPage)],
        });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: i => i.user.id === interaction.user.id,
            time: 300_000, // 5 minutes
        });

        collector.on('collect', async i => {
            if (i.customId === 'first') currentPage = 0;
            if (i.customId === 'prev') currentPage--;
            if (i.customId === 'next') currentPage++;
            if (i.customId === 'last') currentPage = totalPages - 1;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)],
            });
        });

        collector.on('end', async () => {
            // Edit the message to remove buttons after timeout
            const finalEmbed = generateEmbed(currentPage);
            await interaction.editReply({ embeds: [finalEmbed], components: [] });
        });
    },
};