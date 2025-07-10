// src/events/ready.ts
import { Events, Client } from 'discord.js';

export const event = {
    name: Events.ClientReady,
    once: true, // This event should only run once
    execute: (client: Client) => {
        if (!client.user) {
            client.logger.error('Client user is not available.');
            return;
        }
        client.logger.info(`Ready! Logged in as ${client.user.tag}`);
    },
};