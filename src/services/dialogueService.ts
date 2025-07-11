// src/services/dialogueService.ts
import type { Client } from 'discord.js';

/**
 * Manages the retrieval of all user-facing dialogue strings.
 * It caches the dialogue for the currently active persona to minimize
 * database lookups.
 */
export class DialogueService {
    private client: Client;
    private dialogue: Map<string, string> = new Map();
    private activePersona: string = 'default';

    constructor(client: Client) {
        this.client = client;
    }

    /**
     * Initializes the service on bot startup. It loads the dialogue for the
     * currently configured active persona.
     */
    public initialize(): void {
        this.client.logger.info('Initializing DialogueService...');
        const settings = this.client.settings.getSettings();
        this.activePersona = settings?.active_persona_name ?? 'default';
        this.loadDialogue();
    }

    /**
     * Re-fetches the active persona from settings and re-populates the
     * internal dialogue cache. Called after the persona is changed.
     */
    public reload(): void {
        this.client.logger.info('Reloading dialogue cache...');
        const settings = this.client.settings.getSettings();
        this.activePersona = settings?.active_persona_name ?? 'default';
        this.loadDialogue();
    }

    /**
     * Retrieves a dialogue string by its key and performs placeholder replacements.
     * @param key The unique key for the dialogue string (e.g., 'command.error.generic').
     * @param replacements An optional object of placeholders to replace in the string.
     * @returns The formatted dialogue string.
     */
    public get(key: string, replacements?: Record<string, string | number>): string {
        let text = this.dialogue.get(key);

        if (!text) {
            this.client.logger.warn(`Dialogue key not found: '${key}'. Falling back to generic error.`);
            // Fallback to prevent crashes, but fetch the generic error string
            // itself through the same system.
            text = this.dialogue.get('error.generic') ?? 'An unexpected error occurred.';
        }

        if (replacements) {
            for (const [placeholder, value] of Object.entries(replacements)) {
                // Using a global regex to replace all occurrences of the placeholder.
                text = text.replace(new RegExp(`{${placeholder}}`, 'g'), String(value));
            }
        }

        return text;
    }

    /**
     * Loads all dialogue strings for the active persona from the database
     * into the in-memory cache.
     */
    private loadDialogue(): void {
        this.client.logger.info(`Loading dialogue for persona: '${this.activePersona}'`);
        try {
            const dialogues = this.client.settings.getDialoguesForPersona(this.activePersona);
            this.dialogue.clear();
            for (const item of dialogues) {
                this.dialogue.set(item.key, item.text);
            }
            this.client.logger.info(`Loaded ${this.dialogue.size} dialogue strings.`);
        } catch (error) {
            this.client.logger.error({ err: error, persona: this.activePersona }, 'Failed to load dialogue from database.');
        }
    }
} 