// src/commands/search.ts
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Client } from 'discord.js';
import type { Command } from '../types/command';

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription("Retrieves a specific day's archive.") // Dialogue key: search.desc
        .addIntegerOption(option =>
            option
                .setName('day')
                .setDescription('The day number to search for.') // Dialogue key: search.option.day.desc
                .setRequired(true)
                .setMinValue(1),
        ),
    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const day = interaction.options.getInteger('day', true);

        const result = client.posts.findByDay(day);

        if (!result) {
            await interaction.reply({
                content: client.dialogueService.get('search.fail.notFound', { day }),
                ephemeral: true,
            });
            return;
        }

        const { post, media } = result;
        const jumpUrl = `https://discord.com/channels/${interaction.guildId}/${post.channel_id}/${post.message_id}`;

        const embed = new EmbedBuilder()
            .setTitle(client.dialogueService.get('search.embed.title', { day }))
            .setDescription(client.dialogueService.get('search.embed.description', { timestamp: post.timestamp, jumpUrl }))
            .setColor('#8B4513') // A nice brown color
            .setImage(media[0]?.url ?? null) // Display the first image in the embed
            .setTimestamp(post.timestamp * 1000);

        const otherMedia = media.slice(1);
        if (otherMedia.length > 0) {
            const MAX_LINKS_IN_FIELD = 3;
            let extraMediaLinks = otherMedia
                .slice(0, MAX_LINKS_IN_FIELD)
                .map((m, i) => `[Media ${i + 2}](${m.url})`)
                .join(' | ');
            
            const remaining = otherMedia.length - MAX_LINKS_IN_FIELD;
            if (remaining > 0) {
                extraMediaLinks += client.dialogueService.get('search.embed.field.more', { remaining });
            }

            embed.addFields({
                name: client.dialogueService.get('search.embed.field.additionalMedia'),
                value: extraMediaLinks,
            });
        }

        await interaction.reply({ embeds: [embed] });
    },
};