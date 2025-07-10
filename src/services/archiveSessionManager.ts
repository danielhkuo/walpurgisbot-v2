// src/services/archiveSessionManager.ts
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    ComponentType,
    GuildMember,
    Message,
    ModalBuilder,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
} from 'discord.js';
import { parseMessageContent } from '../lib/archiveParser';
import type { PostRepository } from '../database/postRepository';
import type { CreatePostInput } from '../types/database';
import { config } from '../config';

// The state of a pending archive session for a user.
interface ArchiveSession {
    userId: string;
    channelId: string;
    initialMessage: Message;
    mediaUrls: string[];
    detectedDays: number[];
    confidence: 'high' | 'low' | 'none';
    evaluationTimer: NodeJS.Timeout;
}

export class ArchiveSessionManager {
    private client: Client;
    private posts: PostRepository;
    private sessions = new Map<string, ArchiveSession>();

    // Constants for timers, can be moved to config if needed
    private readonly SESSION_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
    private readonly MEDIA_ONLY_PROMPT_DELAY_MS = 15 * 1000; // 15 seconds

    constructor(client: Client, postRepository: PostRepository) {
        this.client = client;
        this.posts = postRepository;
    }

    /**
     * Main entry point for processing a potential archive message.
     */
    public async handleMessage(message: Message): Promise<void> {
        if (message.author.id !== config.JOHAN_USER_ID) return;

        // Ignore messages without any potential content (no text AND no media)
        if (!message.content && message.attachments.size === 0) return;

        let session = this.sessions.get(message.author.id);

        if (session) {
            // Update existing session
            this.client.logger.info(`Updating existing session for user ${message.author.id}`);
            clearTimeout(session.evaluationTimer); // Reset timer on new activity
            const parseResult = parseMessageContent(message.content);
            session.detectedDays.push(...parseResult.detectedDays);
            // If new text has high confidence, upgrade the session's confidence
            if (parseResult.confidence === 'high') {
                session.confidence = 'high';
            }
        } else {
            // Create a new session if there's media
            if (message.attachments.size === 0) return; // Don't start a session for a text-only message

            this.client.logger.info(`Creating new session for user ${message.author.id}`);
            const parseResult = parseMessageContent(message.content);
            session = {
                userId: message.author.id,
                channelId: message.channel.id,
                initialMessage: message,
                mediaUrls: message.attachments.map(att => att.url),
                detectedDays: parseResult.detectedDays,
                confidence: parseResult.confidence,
                evaluationTimer: setTimeout(() => {}, 0), // Placeholder
            };
        }

        // Set/reset the main session timer and store the session
        session.evaluationTimer = setTimeout(() => this.onSessionTimeout(session!.userId), this.SESSION_LIFETIME_MS);
        this.sessions.set(message.author.id, session);

        // Evaluate immediately
        await this.evaluateSession(session);
    }

    /**
     * Evaluates the current state of a session and takes appropriate action.
     */
    private async evaluateSession(session: ArchiveSession): Promise<void> {
        const { detectedDays, confidence, initialMessage } = session;

        // Case: Complete Session (Happy Path or Benign Duplicate)
        if (detectedDays.length === 1 && confidence === 'high') {
            const day = detectedDays[0];
            
            // Duplicate Check
            if (day && this.posts.findByDay(day)) {
                this.client.logger.warn(`Benign Duplicate: Day ${day} already exists.`);
                await initialMessage.react('⚠️');
                this.cleanupSession(session.userId);
                return;
            }

            // Sequence Check
            const latestDay = this.posts.getMaxDay() ?? 0;
            const expectedDay = latestDay + 1;
            if (day !== expectedDay) {
                await this.promptForOutOfSequence(session, expectedDay);
                // Don't clean up session, wait for admin response
                return;
            }
            
            // All checks passed, archive it!
            await this.archivePost(session, day);
            await initialMessage.react('✅');
            this.cleanupSession(session.userId);
            return;
        }

        // Case: Ambiguous Multi-Day Post
        if (detectedDays.length > 1) {
            await this.promptForAmbiguous(session);
            this.cleanupSession(session.userId); // Fail safely, require manual command
            return;
        }

        // Case: Typo / Unclear Format (Low Confidence)
        if (detectedDays.length === 1 && confidence === 'low') {
            await this.promptForLowConfidence(session);
            // Don't clean up, wait for admin response
            return;
        }
        
        // Case: Partial Session (Media-Only, so far)
        // Reset the shorter media-only timer. If it fires, we prompt.
        clearTimeout(session.evaluationTimer);
        session.evaluationTimer = setTimeout(() => this.onMediaOnlyTimeout(session.userId), this.MEDIA_ONLY_PROMPT_DELAY_MS);
        this.sessions.set(session.userId, session); // Save updated timer
    }

    private async archivePost(session: ArchiveSession, day: number): Promise<void> {
        const postData: CreatePostInput = {
            day,
            message_id: session.initialMessage.id,
            channel_id: session.channelId,
            user_id: session.userId,
            timestamp: Math.floor(session.initialMessage.createdTimestamp / 1000),
            mediaUrls: session.mediaUrls,
        };

        const result = this.posts.createWithMedia(postData);
        if (result) {
            this.client.logger.info({ day, messageId: session.initialMessage.id }, 'Successfully archived post.');
        } else {
            this.client.logger.error({ day, messageId: session.initialMessage.id }, 'Failed to archive post.');
            await session.initialMessage.react('❌');
        }
    }
    
    // --- Admin Prompts ---

    private async promptForOutOfSequence(session: ArchiveSession, expectedDay: number) {
        const day = session.detectedDays[0];
        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`force_archive_${session.initialMessage.id}_${day}`)
                .setLabel(`Force Archive as Day ${day}`)
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId(`ignore_post_${session.initialMessage.id}`)
                .setLabel('Ignore This Post')
                .setStyle(ButtonStyle.Secondary)
        );
        const content = `⚠️ **Sequence Alert:** I expected Day \`${expectedDay}\`, but this post says Day \`${day}\`. This might be a mistake. How should I proceed? ([Original Message](${session.initialMessage.url}))`;
        await this.notifyAdmins(content, [buttons]);
    }

    private async promptForAmbiguous(session: ArchiveSession) {
        const days = session.detectedDays.map(d => `\`Day ${d}\``).join(', ');
        const content = `⚠️ **Manual Action Required:** I detected multiple days (${days}) in a single message. To prevent data errors, please use \`/manual-archive\` for each day, using message ID \`${session.initialMessage.id}\`. ([Original Message](${session.initialMessage.url}))`;
        await this.notifyAdmins(content);
    }

    private async promptForLowConfidence(session: ArchiveSession) {
        const day = session.detectedDays[0];
        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_archive_${session.initialMessage.id}_${day}`)
                .setLabel(`Confirm Archive as Day ${day}`)
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`ignore_post_${session.initialMessage.id}`)
                .setLabel('Ignore')
                .setStyle(ButtonStyle.Secondary)
        );
        const content = `🤔 **Possible Archive Detected:** I found the number \`${day}\` in this message, but the format was unclear. Do you want to archive this as Day ${day}? ([Original Message](${session.initialMessage.url}))`;
        await this.notifyAdmins(content, [buttons]);
    }

    private async promptForMediaOnly(session: ArchiveSession) {
        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`add_day_info_${session.initialMessage.id}`)
                .setLabel('Yes, Add Day Info')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`ignore_post_${session.initialMessage.id}`)
                .setLabel('No, Not an Archive')
                .setStyle(ButtonStyle.Secondary)
        );
        const content = `I saw a new photo from Johan with no day information. Is this a Daily Johan archive? ([Original Message](${session.initialMessage.url}))`;
        await this.notifyAdmins(content, [buttons]);
    }

    // --- Timeout Handlers ---

    private onSessionTimeout(userId: string): void {
        const session = this.sessions.get(userId);
        if (session) {
            this.client.logger.info(`Session for user ${userId} timed out and is being cleaned up.`);
            this.cleanupSession(userId);
        }
    }

    private onMediaOnlyTimeout(userId: string): void {
        const session = this.sessions.get(userId);
        if (session && session.detectedDays.length === 0) {
            this.client.logger.info(`Media-only session for ${userId} detected. Prompting admin.`);
            this.promptForMediaOnly(session);
        }
        // Whether we prompted or not, the session is now stale.
        this.cleanupSession(userId);
    }

    // --- Interaction Handlers ---
    // These will be called from interactionCreate.ts

    public async handleInteraction(interaction: any) {
        const [action, messageId, dayStr] = interaction.customId.split('_');
        const session = this.findSessionByMessageId(messageId);
        
        if (!session && !['force_archive', 'confirm_archive'].includes(action)) {
             await interaction.update({ content: 'This interaction has expired as the original context is gone.', components: [] });
             return;
        }

        switch (action) {
            case 'force_archive':
            case 'confirm_archive':
                // For these, we can reconstruct a temporary session if the original expired.
                const day = parseInt(dayStr, 10);
                const tempSession = await this.recreateSessionFromMessage(messageId, interaction.channel);
                if (!tempSession) {
                    await interaction.update({ content: 'Error: Could not find the original message to archive.', components: [] });
                    return;
                }
                await this.archivePost(tempSession, day);
                await interaction.update({ content: `✅ Action Confirmed. Post has been archived as Day ${day}.`, components: [] });
                // React to original message as well
                tempSession.initialMessage.react('✅').catch(e => this.client.logger.warn("Couldn't react to original message"));
                break;

            case 'ignore_post':
                if(session) this.cleanupSession(session.userId);
                await interaction.update({ content: 'OK, this post will be ignored.', components: [] });
                break;
            
            case 'add_day_info':
                const modal = new ModalBuilder()
                    .setCustomId(`submit_day_info_${messageId}`)
                    .setTitle('Add Day Info to Archive');
                const dayInput = new TextInputBuilder()
                    .setCustomId('day_input')
                    .setLabel('What day number should this be?')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(dayInput));
                await interaction.showModal(modal);
                break;
        }
    }
    
    public async handleModalSubmit(interaction: any) {
        const [_, messageId] = interaction.customId.split('_');
        const dayString = interaction.fields.getTextInputValue('day_input');
        const day = parseInt(dayString, 10);

        if (isNaN(day) || day < 1) {
            await interaction.reply({ content: 'Error: Invalid day number.', ephemeral: true });
            return;
        }
        
        if (this.posts.findByDay(day)) {
            await interaction.reply({ content: `Error: Day ${day} already exists in the archive.`, ephemeral: true });
            return;
        }

        const session = await this.recreateSessionFromMessage(messageId, interaction.channel);
        if (!session) {
            await interaction.reply({ content: 'Error: Could not find the original message.', ephemeral: true });
            return;
        }

        await this.archivePost(session, day);
        await interaction.reply({ content: `✅ Success! Post has been archived as Day ${day}.`, ephemeral: true });
        session.initialMessage.react('✅').catch(e => this.client.logger.warn("Couldn't react to original message"));
    }

    // --- Utility Methods ---

    private cleanupSession(userId: string): void {
        const session = this.sessions.get(userId);
        if (session) {
            clearTimeout(session.evaluationTimer);
            this.sessions.delete(userId);
        }
    }

    private findSessionByMessageId(messageId: string): ArchiveSession | undefined {
        for (const session of this.sessions.values()) {
            if (session.initialMessage.id === messageId) {
                return session;
            }
        }
        return undefined;
    }
    
    private async recreateSessionFromMessage(messageId: string, channel: TextChannel | null): Promise<ArchiveSession | null> {
        if (!channel) return null;
        try {
            const message = await channel.messages.fetch(messageId);
            return {
                userId: message.author.id,
                channelId: channel.id,
                initialMessage: message,
                mediaUrls: message.attachments.map(a => a.url),
                // These don't matter for a recreated session, as the action is already decided
                detectedDays: [], 
                confidence: 'none',
                evaluationTimer: setTimeout(() => {}, 0)
            };
        } catch (error) {
            this.client.logger.error({ err: error, messageId }, "Failed to fetch message for session recreation");
            return null;
        }
    }

    private async notifyAdmins(content: string, components: ActionRowBuilder<ButtonBuilder>[] = []): Promise<void> {
        // This logic finds the first channel where an admin can see the message.
        // A more robust solution might be a dedicated, configured admin channel.
        for (const guild of this.client.guilds.cache.values()) {
            try {
                const adminRole = await guild.roles.fetch(config.ADMIN_ROLE_ID);
                if (!adminRole) continue;

                const channel = guild.channels.cache.find(c =>
                    c.type === ChannelType.GuildText &&
                    c.permissionsFor(adminRole)?.has('ViewChannel')
                ) as TextChannel | undefined;
                
                if (channel) {
                    // Correct approach for a channel: send a public message and tag the role.
                    await channel.send({
                        content: `<@&${config.ADMIN_ROLE_ID}> ${content}`,
                        components
                    });
                    this.client.logger.info(`Sent admin notification to channel ${channel.id}`);
                    return; // Sent successfully
                }
            } catch (error) {
                this.client.logger.error({ err: error, guildId: guild.id }, 'Failed to send admin notification.');
            }
        }
        this.client.logger.error('Could not find any suitable channel to send an admin notification.');
    }
}