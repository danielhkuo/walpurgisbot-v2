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

// Constants for layout
const COLUMNS = 2;
const ROWS_PER_COLUMN = 25;
const DAYS_PER_PAGE = ROWS_PER_COLUMN * COLUMNS; // Display 50 days per page (2 columns * 25 rows)
const COLUMN_SPACING = 4; // Number of spaces between columns

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

        if (start > end) {
            await interaction.editReply(client.dialogueService.get('status.fail.startAfterEnd'));
            return;
        }

        const archivedDays = new Set(client.posts.getArchivedDaysInRange(start, end));

        const totalDays = end - start + 1;
        const totalPages = Math.ceil(totalDays / DAYS_PER_PAGE);

        const generateEmbed = (page: number) => {
            const pageStartDay = start + page * DAYS_PER_PAGE;
            const pageEndDay = Math.min(start + (page + 1) * DAYS_PER_PAGE - 1, end);

            const daysOnPage: number[] = [];
            for (let day = pageStartDay; day <= pageEndDay; day++) {
                daysOnPage.push(day);
            }

            if (daysOnPage.length === 0) {
                return new EmbedBuilder()
                    .setTitle(client.dialogueService.get('status.embed.title', { start, end }))
                    .setDescription(client.dialogueService.get('status.embed.noData'))
                    .setColor('#5865F2')
                    .setFooter({ text: client.dialogueService.get('status.embed.footer', { page: page + 1, totalPages }) });
            }

            // Calculate the max length for a single status line to ensure column alignment.
            // This accounts for the longest day number (from 'end') and the '✅'/'❌' emoji.
            const longestDayNumStrLength = String(end).length;
            const dummyDay = '0'.repeat(longestDayNumStrLength); // Use a dummy string of same length as longest day number
            const dummyStatusEmoji = '✅'; // Emojis are typically 2 characters wide for length calculations
            
            // Get the length of the longest possible line based on the dialogue string and max day number length
            const longestPossibleLine = client.dialogueService.get('status.embed.dayStatus', { day: dummyDay, status: dummyStatusEmoji });
            const maxLineLength = longestPossibleLine.length;

            // Prepare columns to store formatted day status strings
            const columns: string[][] = Array(COLUMNS).fill(null).map(() => []);

            // Populate columns with padded status lines
            for (let i = 0; i < daysOnPage.length; i++) {
                const day = daysOnPage[i]!;
                const statusEmoji = archivedDays.has(day) ? '✅' : '❌';
                const dayStatusLine = client.dialogueService.get('status.embed.dayStatus', { day, status: statusEmoji });
                
                // Pad the current line to the calculated maximum length
                const paddedDayStatusLine = dayStatusLine.padEnd(maxLineLength, ' ');

                const columnIndex = Math.floor(i / ROWS_PER_COLUMN);
                if (columnIndex < COLUMNS) { // Ensure we don't go out of bounds for partial last pages
                    columns[columnIndex]!.push(paddedDayStatusLine);
                }
            }

            // Combine columns row by row to form the final page content
            const pageContentRows: string[] = [];
            for (let r = 0; r < ROWS_PER_COLUMN; r++) {
                let rowString = '';
                for (let c = 0; c < COLUMNS; c++) {
                    const line = columns[c]?.[r]; // Get line from the current column and row
                    if (line !== undefined) {
                        rowString += line;
                    } else {
                        // If a column is shorter than ROWS_PER_COLUMN, fill empty spots with spaces to maintain alignment
                        rowString += ' '.repeat(maxLineLength);
                    }
                    // Add spacing between columns, but not after the last column
                    if (c < COLUMNS - 1) {
                        rowString += ' '.repeat(COLUMN_SPACING);
                    }
                }
                // Only add the row if it contains actual content (not just trailing spaces from shorter columns)
                if (rowString.trim().length > 0) {
                    pageContentRows.push(rowString);
                }
            }

            const pageContent = pageContentRows.join('\n') || client.dialogueService.get('status.embed.noData');

            return new EmbedBuilder()
                .setTitle(client.dialogueService.get('status.embed.title', { start, end }))
                .setDescription(`\`\`\`\n${pageContent}\n\`\`\``) // Wrap in code block for monospace font
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