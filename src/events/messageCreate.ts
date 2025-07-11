// src/events/messageCreate.ts
import { Events, Message, Client } from 'discord.js';
import type { Event } from '../types/event';

export const event: Event<Events.MessageCreate> = {
    name: Events.MessageCreate,
    execute: async (client: Client, message: Message) => {
        // The manager itself decides if it should act on the message.
        await client.archiveSessionManager.handleMessage(message);
    },
};