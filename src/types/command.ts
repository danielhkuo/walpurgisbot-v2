// src/types/command.ts
import type {
    Client,
    CommandInteraction,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    ChatInputCommandInteraction,
    SlashCommandSubcommandsOnlyBuilder,
    AutocompleteInteraction,
} from 'discord.js';

// We use ChatInputCommandInteraction for stricter type safety on options.
export interface Command {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}