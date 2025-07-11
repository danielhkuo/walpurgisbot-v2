// src/events/ready.ts
import { Events, Client } from 'discord.js';
import type { Event } from '../types/event';

export const event: Event<Events.ClientReady> = {
    name: Events.ClientReady,
    once: true,
    execute: async (client: Client, readyClient: Client<true>) => {
        if (!readyClient.user) {
            client.logger.error('Client user is not available on ready event.');
            return;
        }
        client.logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
        try {
            // Initialize all services that need to run startup logic.
            await client.notificationService.initialize();
            await client.archiveSessionManager.initialize();
        } catch (error) {
            client.logger.error({ err: error }, 'Failed to initialize services.');
        }
    },
};