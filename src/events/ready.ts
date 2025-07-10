// src/events/ready.ts
import { Events, Client } from 'discord.js';
import type { Event } from '../types/event';

export const event: Event<Events.ClientReady> = {
    name: Events.ClientReady,
    once: true, // This event should only run once
    execute: (client: Client, readyClient: Client<true>) => {
        // The `client` parameter is our main client instance.
        // The `readyClient` is provided by the event and is guaranteed to be logged in.
        if (!readyClient.user) {
            client.logger.error('Client user is not available on ready event.');
            return;
        }
        client.logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
    },
};