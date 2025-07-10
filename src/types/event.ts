// src/types/event.ts
import type { Client, ClientEvents } from 'discord.js';

export interface Event<T extends keyof ClientEvents = keyof ClientEvents> {
    name: T;
    once?: boolean;
    execute: (client: Client, ...args: ClientEvents[T]) => Promise<void> | void;
} 