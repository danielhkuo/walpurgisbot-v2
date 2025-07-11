// src/commands/admin/settings.ts

import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, type AutocompleteInteraction, type TextChannel } from 'discord.js';
import type { Client } from 'discord.js';
import type { Command } from '../../types/command';
import { timezones } from '../../lib/timezones';

async function handleSetChannel(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    const channel = interaction.options.getChannel('channel', true);

    if (channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: 'Please select a text channel.', ephemeral: true });
        return;
    }

    if (!interaction.guild?.members.me) {
        client.logger.error('Could not fetch bot member information in guild.');
        await interaction.reply({
            content: client.dialogueService.get('settings.channel.fail.internal'),
            ephemeral: true,
        });
        return;
    }

    const textChannel = channel as TextChannel;
    const permissions = textChannel.permissionsFor(interaction.guild.members.me);
    if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions?.has(PermissionFlagsBits.SendMessages)) {
        await interaction.reply({
            content: client.dialogueService.get('settings.channel.fail.perms', {
                channel: textChannel.toString(),
            }),
            ephemeral: true,
        });
        return;
    }

    try {
        client.settings.updateSettings({ notification_channel_id: channel.id });
        client.notificationService.rescheduleJobs();
        await interaction.reply({
            content: client.dialogueService.get('settings.channel.success', {
                channel: textChannel.toString(),
            }),
            ephemeral: true,
        });
    } catch (error) {
        client.logger.error({ err: error, guildId: interaction.guildId }, 'Failed to set notification channel.');
        await interaction.reply({
            content: client.dialogueService.get('settings.channel.fail.save'),
            ephemeral: true,
        });
    }
}

async function handleSetTimezone(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    const timezone = interaction.options.getString('timezone', true);

    if (!timezones.includes(timezone)) {
        await interaction.reply({
            content: client.dialogueService.get('settings.timezone.fail.invalid', {
                timezone,
            }),
            ephemeral: true,
        });
        return;
    }

    try {
        client.settings.updateSettings({ timezone });
        client.notificationService.rescheduleJobs();
        await interaction.reply({
            content: client.dialogueService.get('settings.timezone.success', {
                timezone,
            }),
            ephemeral: true,
        });
    } catch (error) {
        client.logger.error({ err: error, guildId: interaction.guildId }, 'Failed to set timezone.');
        await interaction.reply({
            content: client.dialogueService.get('settings.timezone.fail.save'),
            ephemeral: true,
        });
    }
}

async function handleSetReminder(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    const status = interaction.options.getString('status', true) as 'enable' | 'disable';
    const time = interaction.options.getString('time');

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (status === 'enable') {
        if (!time) {
            await interaction.reply({
                content: client.dialogueService.get('settings.reminder.fail.noTime'),
                ephemeral: true,
            });
            return;
        }
        if (!timeRegex.test(time)) {
            await interaction.reply({
                content: client.dialogueService.get('settings.reminder.fail.invalidTime'),
                ephemeral: true,
            });
            return;
        }
    }

    const patch = {
        reminder_enabled: status === 'enable',
        reminder_time: status === 'enable' ? time : null,
    };

    const successMsg =
        status === 'enable'
            ? client.dialogueService.get('settings.reminder.enable.success', { time: time! })
            : client.dialogueService.get('settings.reminder.disable.success');

    try {
        client.settings.updateSettings(patch);
        client.notificationService.rescheduleJobs();
        await interaction.reply({ content: successMsg, ephemeral: true });
    } catch (err) {
        client.logger.error({ err }, 'Failed to update reminder settings');
        await interaction.reply({
            content: client.dialogueService.get('error.generic.tryAgain'),
            ephemeral: true,
        });
    }
}

async function handleSetPersona(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    const name = interaction.options.getString('name', true);

    const persona = client.settings.getPersona(name);
    if (!persona) {
        await interaction.reply({
            content: client.dialogueService.get('settings.persona.set.fail.notFound', { name }),
            ephemeral: true,
        });
        return;
    }

    try {
        client.settings.updateSettings({ active_persona_name: name });
        client.dialogueService.reload();
        await interaction.reply({
            content: client.dialogueService.get('settings.persona.set.success', { name }),
            ephemeral: true,
        });
    } catch (error) {
        client.logger.error({ err: error, guildId: interaction.guildId }, 'Failed to set persona.');
        await interaction.reply({
            content: client.dialogueService.get('settings.persona.set.fail.generic'),
            ephemeral: true,
        });
    }
}

async function handleListPersonas(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
    try {
        const allPersonas = client.settings.getAllPersonas();
        const currentSettings = client.settings.getSettings();
        const activePersonaName = currentSettings?.active_persona_name ?? 'default';

        if (allPersonas.length === 0) {
            await interaction.reply({
                content: client.dialogueService.get('settings.persona.list.empty'),
                ephemeral: true,
            });
            return;
        }

        const list = allPersonas
            .map(p => {
                const isActive = p.name === activePersonaName;
                const activeSuffix = isActive ? client.dialogueService.get('settings.persona.list.activeSuffix') : '';
                return `• **${p.name}**${activeSuffix}: ${p.description}`;
            })
            .join('\n');

        const content = `${client.dialogueService.get('settings.persona.list.title')}\n${list}`;
        await interaction.reply({ content, ephemeral: true });
    } catch (error) {
        client.logger.error({ err: error, guildId: interaction.guildId }, 'Failed to list personas.');
        await interaction.reply({
            content: client.dialogueService.get('settings.persona.list.fail.generic'),
            ephemeral: true,
        });
    }
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure bot settings for this server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Sets the channel for bot notifications (reminders, reports).')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The text channel to send notifications to.')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText),
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
                        .addChoices(
                            { name: 'Enable', value: 'enable' },
                            { name: 'Disable', value: 'disable' },
                        ),
                )
                .addStringOption(option =>
                    option
                        .setName('time')
                        .setDescription('The time to send the reminder (24h HH:MM format). Required if enabling.'),
                ),
        )
        .addSubcommandGroup(group =>
            group
                .setName('persona')
                .setDescription("Manages the bot's persona (dialogue style).")
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('set')
                        .setDescription('Sets the active persona for the bot.')
                        .addStringOption(option =>
                            option
                                .setName('name')
                                .setDescription('The name of the persona to activate.')
                                .setRequired(true)
                                .setAutocomplete(true),
                        ),
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('list').setDescription('Lists all available personas.'),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, client: Client) {
        const subcommand = interaction.options.getSubcommand(true);
        const group = interaction.options.getSubcommandGroup(false);

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
            case 'set':
                if (group === 'persona') await handleSetPersona(interaction, client);
                break;
            case 'list':
                if (group === 'persona') await handleListPersonas(interaction, client);
                break;
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        const group = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(true);

        if (subcommand === 'timezone') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const filtered = timezones
                .filter(tz => tz.toLowerCase().includes(focusedValue))
                .slice(0, 25); // Discord allows a max of 25 choices

            await interaction.respond(filtered.map(choice => ({ name: choice, value: choice })));
        } else if (group === 'persona' && subcommand === 'set') {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const client = interaction.client as Client;
            const personas = client.settings.getAllPersonas();
            const filtered = personas
                .filter(p => p.name.toLowerCase().includes(focusedValue))
                .slice(0, 25);
            await interaction.respond(filtered.map(choice => ({ name: choice.name, value: choice.name })));
        }
    },
};