// src/events/ready.ts
import type { Client } from 'discord.js';
import type { Event } from '../types/event';

export const event: Event<'ready'> = {
    name: 'ready',
    once: true,
    async execute(client: Client) {
        if (!client.user) {
            client.logger.error('Client user is not available.');
            return;
        }
        client.logger.info(`Ready! Logged in as ${client.user.tag}`);
        try {
            await client.dialogueService.initialize();
            // Initialize all services that need to run startup logic.
            await client.notificationService.initialize();
            client.archiveSessionManager.initialize();
        } catch (error) {
            client.logger.error({ err: error }, 'Failed to initialize services on startup.');
        }
    },
};