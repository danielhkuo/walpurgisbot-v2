// src/types/contextMenuCommand.ts
import type {
    Client,
    ContextMenuCommandBuilder,
    MessageContextMenuCommandInteraction,
} from 'discord.js';

export interface MessageContextMenuCommand {
    data: ContextMenuCommandBuilder;
    execute: (
        interaction: MessageContextMenuCommandInteraction,
        client: Client,
    ) => Promise<void>;
} 