// src/services/archiveSessionManager.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Message,
  ModalBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import { parseMessageContent } from '../lib/archiveParser';
import type { PostRepository } from '../database/postRepository';
import type { SessionData, SessionRepository } from '../database/sessionRepository';
import type { CreatePostInput } from '../types/database';
import { config } from '../config';
import { createArchiveButtonId, createArchiveModalId, parseId } from '../lib/customIdManager';

/**
 * Represents an active, in-memory session. The data is backed by the database,
 * but this object also holds the live Message object.
 */
interface LiveArchiveSession extends SessionData {
  initialMessage: Message;
}

/**
 * Manages stateful, short-lived sessions to handle complex user posting
 * patterns for archiving content.
 */
export class ArchiveSessionManager {
  private readonly client: Client;
  private readonly posts: PostRepository;
  private readonly sessions: SessionRepository; // The persistent store

  /** Manages the live NodeJS.Timeout objects for active sessions. */
  private readonly activeTimers = new Map<string, NodeJS.Timeout>();

  /** The maximum duration a session can exist before it is timed out. */
  private readonly SESSION_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
  /**
   * The delay before prompting an admin if a media-only post is received.
   * This gives the user time to post a follow-up comment with the day number.
   */
  private readonly MEDIA_ONLY_PROMPT_DELAY_MS = 15 * 1000; // 15 seconds
  /** The number of previous messages to check for context. */
  private readonly LOOK_BEHIND_LIMIT = 5;

  constructor(client: Client, postRepository: PostRepository, sessionRepository: SessionRepository) {
    this.client = client;
    this.posts = postRepository;
    this.sessions = sessionRepository;
  }

  /**
   * Initializes the manager on bot startup.
   * It cleans up expired sessions and re-hydrates timers for active ones.
   */
  public async initialize() {
      this.client.logger.info('Initializing ArchiveSessionManager...');
      // 1. Clean up any sessions that expired while the bot was offline.
      this.sessions.deleteExpired();

      // 2. Load all active sessions from the database.
      const activeSessions = this.sessions.findAll();
      this.client.logger.info(`Found ${activeSessions.length} active session(s) to re-hydrate.`);

      for (const sessionData of activeSessions) {
          const now = Math.floor(Date.now() / 1000);
          const remainingTime = (sessionData.expiresAt - now) * 1000;

          if (remainingTime <= 0) {
              // This shouldn't happen due to deleteExpired, but as a safeguard:
              this.sessions.delete(sessionData.userId);
              continue;
          }

          // 3. Re-create the timeout for the session.
          const timer = setTimeout(() => this.onSessionTimeout(sessionData.userId), remainingTime);
          this.activeTimers.set(sessionData.userId, timer);
      }
  }

  public async handleMessage(message: Message): Promise<void> {
    // Encapsulated logic: The manager decides if it should act on the message.
    if (message.author.bot || message.author.id !== config.JOHAN_USER_ID) {
        return;
    }
    if (!message.content && message.attachments.size === 0) return;

    let sessionData = this.sessions.get(message.author.id);

    if (sessionData) {
      // Update existing session (media-first, text-second case).
      this.client.logger.info(`Updating existing session for user ${message.author.id}`);
      this.clearTimer(message.author.id);
      
      const parseResult = parseMessageContent(message.content);
      sessionData.detectedDays.push(...parseResult.detectedDays);
      if (parseResult.confidence === 'high') {
        sessionData.confidence = 'high';
      }
    } else {
      // Create a new session if there's media.
      if (message.attachments.size > 0) {
        this.client.logger.info(`Creating new session for user ${message.author.id}`);

        let { detectedDays, confidence } = parseMessageContent(message.content);

        if (detectedDays.length === 0) {
          this.client.logger.info('Media message has no day info. Looking at recent message history...');
          try {
            const recentMessages = await message.channel.messages.fetch({
              before: message.id,
              limit: this.LOOK_BEHIND_LIMIT,
            });

            for (const recentMsg of recentMessages.values()) {
              if (recentMsg.author.id === config.JOHAN_USER_ID) {
                const historicalResult = parseMessageContent(recentMsg.content);
                if (historicalResult.detectedDays.length > 0) {
                  detectedDays = historicalResult.detectedDays;
                  confidence = historicalResult.confidence;
                  break;
                }
              }
            }
          } catch (err) {
            this.client.logger.error({ err }, 'Failed to fetch recent messages for context.');
          }
        }

        sessionData = {
          userId: message.author.id,
          channelId: message.channel.id,
          messageId: message.id, // The media message is the anchor.
          mediaUrls: message.attachments.map(att => att.url),
          detectedDays,
          confidence,
          expiresAt: 0, // Will be set shortly.
        };
      } else {
        // Text-only message and no active session. Ignore it.
        return;
      }
    }

    // Set/reset the main session timer and persist the session.
    const newExpiry = Math.floor((Date.now() + this.SESSION_LIFETIME_MS) / 1000);
    sessionData.expiresAt = newExpiry;
    
    const timer = setTimeout(() => this.onSessionTimeout(sessionData!.userId), this.SESSION_LIFETIME_MS);
    this.activeTimers.set(sessionData.userId, timer);
    this.sessions.upsert(sessionData);

    // The rest of the logic requires the `Message` object, which is not persisted.
    // We must fetch it to create a `LiveArchiveSession`.
    const liveSession = await this.createLiveSession(sessionData);
    if (liveSession) {
        await this.evaluateSession(liveSession);
    }
  }

  private async createLiveSession(data: SessionData): Promise<LiveArchiveSession | null> {
      try {
          const channel = await this.client.channels.fetch(data.channelId) as TextChannel;
          const message = await channel.messages.fetch(data.messageId);
          return { ...data, initialMessage: message };
      } catch (error) {
          this.client.logger.error({ err: error, session: data }, 'Failed to fetch message for live session. Cleaning up.');
          this.cleanupSession(data.userId);
          return null;
      }
  }

  private async evaluateSession(session: LiveArchiveSession): Promise<void> {
    const { detectedDays, confidence, initialMessage } = session;

    // Case: Complete Session (Happy Path or Benign Duplicate).
    if (detectedDays.length === 1 && confidence === 'high') {
      const day = detectedDays[0] as number;

      if (this.posts.findByDay(day)) {
        this.client.logger.warn(`Benign Duplicate: Day ${day} already exists.`);
        await initialMessage.react('⚠️');
        this.cleanupSession(session.userId);
        return;
      }

      const latestDay = this.posts.getMaxDay() ?? 0;
      const expectedDay = latestDay + 1;
      if (day !== expectedDay) {
        await this.promptForOutOfSequence(session, expectedDay);
        // Don't clean up; let the timeout or admin action handle it.
        return;
      }

      await this.archivePost(session, day);
      await initialMessage.react('✅');
      this.cleanupSession(session.userId);
      return;
    }

    // Case: Ambiguous Multi-Day Post.
    if (detectedDays.length > 1) {
      await this.promptForAmbiguous(session);
      this.cleanupSession(session.userId);
      return;
    }

    // Case: Typo / Unclear Format (Low Confidence).
    if (detectedDays.length === 1 && confidence === 'low') {
      await this.promptForLowConfidence(session);
      return;
    }

    // Case: Partial Session (Media-Only, so far).
    // Reset the shorter media-only timer and update the expiration in the DB.
    this.clearTimer(session.userId);
    const newExpiry = Math.floor((Date.now() + this.MEDIA_ONLY_PROMPT_DELAY_MS) / 1000);
    session.expiresAt = newExpiry;
    this.sessions.upsert(session);
    
    const timer = setTimeout(() => this.onMediaOnlyTimeout(session.userId), this.MEDIA_ONLY_PROMPT_DELAY_MS);
    this.activeTimers.set(session.userId, timer);
  }

  private async archivePost(session: LiveArchiveSession, day: number): Promise<void> {
    const postData: CreatePostInput = {
      day,
      message_id: session.messageId,
      channel_id: session.channelId,
      user_id: session.userId,
      timestamp: Math.floor(session.initialMessage.createdTimestamp / 1000),
      mediaUrls: session.mediaUrls,
    };
    
    this.posts.createWithMedia(postData);
    this.client.logger.info({ day, messageId: session.messageId }, 'Successfully archived post.');
  }

  private async promptForOutOfSequence(session: LiveArchiveSession, expectedDay: number) {
      const day = session.detectedDays[0] as number;
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(createArchiveButtonId('force', session.messageId, day)).setLabel(`Force Archive as Day ${day}`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(createArchiveButtonId('ignore', session.messageId)).setLabel('Ignore This Post').setStyle(ButtonStyle.Secondary),
      );
      const content = `⚠️ **Sequence Alert:** I expected Day \`${expectedDay}\`, but this post says Day \`${day}\`. How should I proceed? ([Original Message](${session.initialMessage.url}))`;
      await this.notifyAdmins(content, [buttons]);
  }
  
  private async promptForAmbiguous(session: LiveArchiveSession) {
      const days = session.detectedDays.map(d => `\`Day ${d}\``).join(', ');
      const content = `⚠️ **Manual Action Required:** I detected multiple days (${days}) in a single message. To prevent data errors, please use \`/manual-archive\` for each day, using message ID \`${session.messageId}\`. ([Original Message](${session.initialMessage.url}))`;
      await this.notifyAdmins(content);
    }
  
    private async promptForLowConfidence(session: LiveArchiveSession) {
      const day = session.detectedDays[0] as number;
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(createArchiveButtonId('confirm', session.messageId, day)).setLabel(`Confirm Archive as Day ${day}`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(createArchiveButtonId('ignore', session.messageId)).setLabel('Ignore').setStyle(ButtonStyle.Secondary),
      );
      const content = `🤔 **Possible Archive Detected:** I found the number \`${day}\` in this message, but the format was unclear. Do you want to archive this as Day ${day}? ([Original Message](${session.initialMessage.url}))`;
      await this.notifyAdmins(content, [buttons]);
    }
  
    private async promptForMediaOnly(session: LiveArchiveSession) {
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(createArchiveButtonId('add', session.messageId)).setLabel('Yes, Add Day Info').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(createArchiveButtonId('ignore', session.messageId)).setLabel('No, Not an Archive').setStyle(ButtonStyle.Secondary),
      );
      const content = `I saw a new photo from Johan with no day information. Is this a Daily Johan archive? ([Original Message](${session.initialMessage.url}))`;
      await this.notifyAdmins(content, [buttons]);
    }

  // --- Timeout Handlers ---
  private onSessionTimeout(userId: string): void {
    this.client.logger.info(`Session for user ${userId} timed out. Cleaning up.`);
    this.cleanupSession(userId);
  }

  private async onMediaOnlyTimeout(userId: string): Promise<void> {
      const sessionData = this.sessions.get(userId);
      if (sessionData && sessionData.detectedDays.length === 0) {
          this.client.logger.info(`Media-only session for ${userId} detected. Prompting admin.`);
          const liveSession = await this.createLiveSession(sessionData);
          if (liveSession) {
              await this.promptForMediaOnly(liveSession);
          }
      }
      // Let the main session timer handle the final cleanup
  }

  // --- Interaction Handlers ---
  public async handleInteraction(interaction: ButtonInteraction) {
    const { action, args } = parseId(interaction.customId);
    const messageId = args[0] ?? '';
    const dayStr = args[1];

    const sessionData = this.findSessionByMessageId(messageId);

    switch (action) {
      case 'force':
      case 'confirm': {
        const day = parseInt(dayStr ?? '0', 10);
        const liveSession = sessionData ? await this.createLiveSession(sessionData) : await this.recreateLiveSessionFromMessage(messageId, interaction.channel as TextChannel);
        
        if (!liveSession) {
          await interaction.update({ content: 'Error: Could not find the original message to archive.', components: [] });
          return;
        }
        await this.archivePost(liveSession, day);
        await interaction.update({ content: `✅ Action Confirmed. Post has been archived as Day ${day}.`, components: [] });
        liveSession.initialMessage.react('✅').catch(e => this.client.logger.warn("Couldn't react to original message", e));
        this.cleanupSession(liveSession.userId);
        break;
      }
      case 'add': {
          const modal = new ModalBuilder()
              .setCustomId(createArchiveModalId('submitDayInfo', messageId))
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
      case 'ignore':
        if (sessionData) this.cleanupSession(sessionData.userId);
        await interaction.update({ content: 'OK, this post will be ignored.', components: [] });
        break;
    }
  }
  
  public async handleModalSubmit(interaction: ModalSubmitInteraction) {
      const { args } = parseId(interaction.customId);
      const messageId = args[0];
      if (!messageId) return;

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

      const liveSession = await this.recreateLiveSessionFromMessage(messageId, interaction.channel as TextChannel);
      if (!liveSession) {
          await interaction.reply({ content: 'Error: Could not find the original message to archive.', ephemeral: true });
          return;
      }

      await this.archivePost(liveSession, day);
      await interaction.reply({ content: `✅ Success! Post has been archived as Day ${day}.`, ephemeral: true });
      liveSession.initialMessage.react('✅').catch(e => this.client.logger.warn("Couldn't react to original message", e));

      this.cleanupSession(liveSession.userId);
  }

  // --- Utility Methods ---
  private clearTimer(userId: string) {
      const timer = this.activeTimers.get(userId);
      if (timer) {
          clearTimeout(timer);
          this.activeTimers.delete(userId);
      }
  }

  private cleanupSession(userId: string): void {
    this.clearTimer(userId);
    this.sessions.delete(userId);
  }

  private findSessionByMessageId(messageId: string): SessionData | null {
      // This is inefficient but acceptable for a small number of sessions.
      const allSessions = this.sessions.findAll();
      return allSessions.find(s => s.messageId === messageId) ?? null;
  }

  private async recreateLiveSessionFromMessage(messageId: string, channel: TextChannel | null): Promise<LiveArchiveSession | null> {
      if (!channel) return null;
      try {
          const message = await channel.messages.fetch(messageId);
          return {
              userId: message.author.id,
              channelId: channel.id,
              messageId: message.id,
              mediaUrls: message.attachments.map(a => a.url),
              detectedDays: [],
              confidence: 'none',
              expiresAt: 0,
              initialMessage: message,
          };
      } catch (error) {
          this.client.logger.error({ err: error, messageId }, 'Failed to fetch message for session recreation');
          return null;
      }
  }
  
  private async notifyAdmins(
      content: string,
      components: ActionRowBuilder<ButtonBuilder>[] = [],
    ): Promise<void> {
      const settings = this.client.settings.getSettings();
      const notifyChannelId = settings?.notification_channel_id;
      if (!notifyChannelId) {
          this.client.logger.error('Cannot send admin notification: notification channel not set.');
          return;
      }
      try {
          const channel = await this.client.channels.fetch(notifyChannelId);
          if(channel?.type === ChannelType.GuildText) {
              await channel.send({ content: `<@&${config.ADMIN_ROLE_ID}> ${content}`, components });
          }
      } catch(error) {
          this.client.logger.error({ err: error, channel: notifyChannelId }, 'Failed to send admin notification.');
      }
  }
}