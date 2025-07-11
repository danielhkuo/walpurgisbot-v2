// src/commands/admin/settings.ts

import {
    ChannelType,
    PermissionFlagsBits,
    SlashCommandBuilder,
    TextChannel,
} from 'discord.js';
import type { AutocompleteInteraction, ChatInputCommandInteraction, Client } from 'discord.js';
import { timezones } from '../../lib/timezones';
import type { Command } from '../../types/command';

/**
 * A simple regex to validate a string is in 24-hour HH:MM format.
 */
const timeRegex = /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/;

/**
 * Handles setting the notification channel for the bot.
 * @param interaction The chat input command interaction.
 * @param client The Discord client instance.
 */
async function handleSetChannel(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    const channel = interaction.options.getChannel('channel', true) as TextChannel;

    if (!interaction.guild?.members.me) {
        client.logger.error('Could not fetch bot member information in guild.');
        await interaction.reply({
            content: 'An internal error occurred. Could not verify my own permissions.',
            ephemeral: true,
        });
        return;
    }

    const permissions = channel.permissionsFor(interaction.guild.members.me);
    if (!permissions.has(PermissionFlagsBits.ViewChannel) || !permissions.has(PermissionFlagsBits.SendMessages)) {
        await interaction.reply({
            content: `❌ I need **View Channel** and **Send Messages** permissions in ${channel} to send notifications.`,
            ephemeral: true,
        });
        return;
    }

    try {
        client.settings.updateSettings({ notification_channel_id: channel.id });
        client.notificationService.rescheduleJobs();
        await interaction.reply({
            content: `✅ Success! Bot notifications will now be sent to ${channel}.`,
            ephemeral: true,
        });
    } catch (error) {
        client.logger.error({ err: error, guildId: interaction.guildId }, 'Failed to set notification channel.');
        await interaction.reply({
            content: 'An error occurred while saving the channel setting. Please try again.',
            ephemeral: true,
        });
    }
}

/**
 * Handles setting the timezone for the bot's scheduled tasks.
 * @param interaction The chat input command interaction.
 * @param client The Discord client instance.
 */
async function handleSetTimezone(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    const timezone = interaction.options.getString('timezone', true);

    if (!timezones.includes(timezone)) {
        await interaction.reply({
            content: `❌ Invalid timezone \`${timezone}\`. Please select a valid IANA timezone from the list.`,
            ephemeral: true,
        });
        return;
    }

    try {
        client.settings.updateSettings({ timezone });
        client.notificationService.rescheduleJobs();
        await interaction.reply({
            content: `✅ Success! The bot's timezone has been set to \`${timezone}\`.`,
            ephemeral: true,
        });
    } catch (error) {
        client.logger.error({ err: error, guildId: interaction.guildId }, 'Failed to set timezone.');
        await interaction.reply({
            content: 'An error occurred while saving the timezone setting. Please try again.',
            ephemeral: true,
        });
    }
}

/**
 * Handles enabling or disabling the daily missing archive reminder.
 * @param interaction The chat input command interaction.
 * @param client The Discord client instance.
 */
async function handleSetReminder(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    const status = interaction.options.getString('status', true);
    const time = interaction.options.getString('time');

    if (status === 'enable') {
        if (!time) {
            await interaction.reply({ content: '❌ `time` is required when enabling.', ephemeral: true });
            return;
        }
        if (!timeRegex.test(time)) {
            await interaction.reply({ content: '❌ Time must be HH:MM (24-h).', ephemeral: true });
            return;
        }
    }

    const patch =
        status === 'enable'
            ? { reminder_enabled: true, reminder_time: time! }
            : { reminder_enabled: false, reminder_time: null };

    const successMsg =
        status === 'enable'
            ? `✅ Daily reminders **enabled** at \`${time}\`.`
            : '✅ Daily reminders **disabled**.';

    try {
        client.settings.updateSettings(patch);
        client.notificationService.rescheduleJobs();
        await interaction.reply({ content: successMsg, ephemeral: true });
    } catch (err) {
        client.logger.error({ err }, 'Failed to update reminder settings');
        await interaction.reply({ content: 'An error occurred. Try again.', ephemeral: true });
    }
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure bot settings for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false) // This command is guild-only
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Sets the channel for bot notifications (reminders, reports).')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The text channel to send notifications to.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('timezone')
                .setDescription("Sets the bot's timezone for scheduling.")
                .addStringOption(option =>
                    option
                        .setName('timezone')
                        .setDescription('The IANA timezone identifier (e.g., Europe/London).')
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reminder')
                .setDescription('Configures the daily missing archive reminder.')
                .addStringOption(option =>
                    option
                        .setName('status')
                        .setDescription('Enable or disable the daily reminder.')
                        .setRequired(true)
                        .addChoices({ name: 'Enable', value: 'enable' }, { name: 'Disable', value: 'disable' }),
                )
                .addStringOption(option =>
                    option
                        .setName('time')
                        .setDescription('The time to send the reminder (24h HH:MM format). Required if enabling.'),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'channel':
                await handleSetChannel(interaction, client);
                break;
            case 'timezone':
                await handleSetTimezone(interaction, client);
                break;
            case 'reminder':
                await handleSetReminder(interaction, client);
                break;
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        // We only have autocomplete on the 'timezone' subcommand.
        if (interaction.options.getSubcommand() === 'timezone') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const filtered = timezones
                .filter(tz => tz.toLowerCase().includes(focusedValue))
                .slice(0, 25); // Discord allows a max of 25 choices

            await interaction.respond(filtered.map(choice => ({ name: choice, value: choice })));
        }
    },
};