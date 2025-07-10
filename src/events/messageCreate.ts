// src/events/messageCreate.ts
import { Events, Message, Client } from 'discord.js';
import { config } from '../config';
import type { CreatePostInput } from '../types/database';

// In-memory cooldown state (a more robust solution might use a database or Redis, but this is fine for now)
let lastArchiveTimestamp = 0;
const COOLDOWN_HOURS = 12;

export const event = {
    name: Events.MessageCreate,
    execute: async (client: Client, message: Message) => {
        // --- 1. Initial Filtering ---
        if (message.author.id !== config.JOHAN_USER_ID) return; // Not the target user
        if (message.attachments.size === 0) return; // No media attached

        // --- 2. Cooldown Check ---
        const now = Date.now();
        const hoursSinceLastArchive = (now - lastArchiveTimestamp) / (1000 * 60 * 60);
        if (hoursSinceLastArchive < COOLDOWN_HOURS) {
            client.logger.info({ messageId: message.id }, `Message ignored due to active cooldown.`);
            // Optionally, you could DM the user about the cooldown.
            return;
        }

        // --- 3. Extract Day Number using Regex ---
        // This regex looks for "Day", optional "#", and then digits. Case-insensitive.
        const match = message.content.match(/(?:Day\s*#?)\s*(\d+)/i);
        if (!match || !match[1]) {
            client.logger.info({ messageId: message.id }, 'Message from target user has attachments but no day number found.');
            return; // No day number found, do nothing.
        }
        const day = parseInt(match[1], 10);
        
        // --- 4. Data Integrity Validation ---
        const latestDay = client.posts.getMaxDay() ?? 0;
        const expectedDay = latestDay + 1;

        if (day !== expectedDay) {
            // Out-of-sequence post. For V2, we will simply log this and NOT archive.
            // A future enhancement could be a confirmation flow like in V1.
            client.logger.warn({ day, expectedDay, messageId: message.id }, 'Detected out-of-sequence day number. Skipping automatic archive.');
            await message.reply(
                `⚠️ **Hold on!** I was expecting Day \`${expectedDay}\`, but you posted Day \`${day}\`. ` +
                `To prevent errors, I won't automatically archive this. Please use \`/manual-archive\` if this is correct.`
            );
            return;
        }

        if (client.posts.findByDay(day)) {
            client.logger.warn({ day, messageId: message.id }, 'Attempted to auto-archive a day that already exists.');
            await message.reply(`Hmm, I already have an archive for Day \`${day}\`. I'll skip this one.`);
            return;
        }

        // --- 5. Persist to Database ---
        const postData: CreatePostInput = {
            day,
            message_id: message.id,
            channel_id: message.channel.id,
            user_id: message.author.id,
            timestamp: Math.floor(message.createdTimestamp / 1000),
            mediaUrls: message.attachments.map(att => att.url),
        };

        const result = client.posts.createWithMedia(postData);

        if (result) {
            client.logger.info({ day, messageId: message.id }, 'Successfully auto-archived post.');
            await message.react('✅');
            // Update the cooldown timestamp
            lastArchiveTimestamp = now;
        } else {
            client.logger.error({ day, messageId: message.id }, 'Failed to auto-archive post.');
            await message.react('❌');
        }
    },
};