// src/events/messageCreate.ts
import { Events, Message, Client } from 'discord.js';
import { config } from '../config';
import type { Event } from '../types/event';

export const event: Event<Events.MessageCreate> = {
    name: Events.MessageCreate,
    execute: async (client: Client, message: Message) => {
        // 1. Filter out bots and non-target user messages
        if (message.author.bot || message.author.id !== config.JOHAN_USER_ID) {
            return;
        }

        // 2. Delegate to the session manager
        // The manager will handle all further logic.
        await client.archiveSessionManager.handleMessage(message);
    },
};