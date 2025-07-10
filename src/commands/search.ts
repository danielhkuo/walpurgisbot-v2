// src/commands/search.ts
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import type { Command } from '../types/command';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription("Retrieves a specific day's archive.")
        .addIntegerOption(option =>
            option.setName('day').setDescription('The day number to search for.').setRequired(true).setMinValue(1),
        ),
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const day = interaction.options.getInteger('day', true);

        const result = client.posts.findByDay(day);

        if (!result) {
            await interaction.reply({ content: `No archive found for Day ${day}.`, ephemeral: true });
            return;
        }

        const { post, media } = result;
        const jumpUrl = `https://discord.com/channels/${interaction.guildId}/${post.channel_id}/${post.message_id}`;

        const embed = new EmbedBuilder()
            .setTitle(`Archive for Day ${day}`)
            .setDescription(
                `Archived on <t:${post.timestamp}:f>.\n[Jump to Original Message](${jumpUrl})`,
            )
            .setColor('#8B4513') // A nice brown color
            .setImage(media[0]?.url ?? null) // Display the first image in the embed
            .setTimestamp(post.timestamp * 1000);

        // If there are more images, list them in a field, truncating if necessary.
        if (media.length > 1) {
            const MAX_LINKS_IN_FIELD = 5;
            const otherMedia = media.slice(1);
            let extraMediaLinks = otherMedia
                .slice(0, MAX_LINKS_IN_FIELD)
                .map((m, i) => `[Media ${i + 2}](${m.url})`)
                .join(' | ');
            
            const remaining = otherMedia.length - MAX_LINKS_IN_FIELD;
            if (remaining > 0) {
                extraMediaLinks += ` | and ${remaining} more...`;
            }

            embed.addFields({ name: 'Additional Media', value: extraMediaLinks });
        }

        await interaction.reply({ embeds: [embed] });
    },
};