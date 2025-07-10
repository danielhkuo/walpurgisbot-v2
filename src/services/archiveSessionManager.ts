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
  import {parseMessageContent} from '../lib/archiveParser';
  import type {PostRepository} from '../database/postRepository';
  import type {CreatePostInput} from '../types/database';
  import {config} from '../config';
  
  /** The state of a pending archive session for a user. */
  interface ArchiveSession {
    userId: string;
    channelId: string;
    initialMessage: Message;
    mediaUrls: string[];
    detectedDays: number[];
    confidence: 'high' | 'low' | 'none';
    evaluationTimer: NodeJS.Timeout;
  }
  
  /**
   * Manages stateful, short-lived sessions to handle complex user posting
   * patterns for archiving content.
   */
  export class ArchiveSessionManager {
    private readonly client: Client;
    private readonly posts: PostRepository;
    private readonly sessions = new Map<string, ArchiveSession>();
  
    /** The maximum duration a session can exist before it is timed out. */
    private readonly SESSION_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes
    /**
     * The delay before prompting an admin if a media-only post is received.
     * This gives the user time to post a follow-up comment with the day number.
     */
    private readonly MEDIA_ONLY_PROMPT_DELAY_MS = 15 * 1000; // 15 seconds
    /** The number of previous messages to check for context. */
    private readonly LOOK_BEHIND_LIMIT = 5;
  
    constructor(client: Client, postRepository: PostRepository) {
      this.client = client;
      this.posts = postRepository;
    }
  
    /**
     * Main entry point for processing a potential archive message from the target user.
     * It creates a new session if one doesn't exist, or updates an existing one.
     *
     * This method uses a "look-behind" strategy:
     * 1. A session is only created when a message with media is seen.
     * 2. If that message lacks a day number, the bot fetches recent messages to
     *    find context, supporting "text-first, media-second" posting patterns.
     * 3. A follow-up text message will update an existing media-first session.
     * @param message The message received from the user.
     */
    public async handleMessage(message: Message): Promise<void> {
      if (message.author.id !== config.JOHAN_USER_ID) {
        return;
      }
  
      // Ignore messages without any potential content (no text AND no media).
      if (!message.content && message.attachments.size === 0) {
        return;
      }
  
      let session = this.sessions.get(message.author.id);
  
      if (session) {
        // Update existing session (media-first, text-second case).
        this.client.logger.info(
          `Updating existing session for user ${message.author.id}`,
        );
        clearTimeout(session.evaluationTimer); // Reset timer on new activity.
        const parseResult = parseMessageContent(message.content);
        session.detectedDays.push(...parseResult.detectedDays);
        // If new text has high confidence, upgrade the session's confidence.
        if (parseResult.confidence === 'high') {
          session.confidence = 'high';
        }
      } else {
        // Create a new session if there's media.
        if (message.attachments.size > 0) {
          this.client.logger.info(
            `Creating new session for user ${message.author.id}`,
          );
  
          // 1. Parse the current message with media.
          let {detectedDays, confidence} = parseMessageContent(message.content);
  
          // 2. If no days were found, look backward for context (text-first case).
          if (detectedDays.length === 0) {
            this.client.logger.info(
              'Media message has no day info. Looking at recent message history...',
            );
            try {
              const recentMessages = await message.channel.messages.fetch({
                before: message.id,
                limit: this.LOOK_BEHIND_LIMIT,
              });
  
              // Find the most recent message from Johan with day info.
              for (const recentMsg of recentMessages.values()) {
                if (recentMsg.author.id === config.JOHAN_USER_ID) {
                  const historicalResult = parseMessageContent(recentMsg.content);
                  if (historicalResult.detectedDays.length > 0) {
                    this.client.logger.info(
                      {foundIn: recentMsg.id},
                      'Found day info in a previous message.',
                    );
                    detectedDays = historicalResult.detectedDays;
                    confidence = historicalResult.confidence;
                    break; // Stop at the first (most recent) one found.
                  }
                }
              }
            } catch (err) {
              this.client.logger.error(
                {err},
                'Failed to fetch recent messages for context.',
              );
            }
          }
  
          // 3. Create the session with the combined context.
          session = {
            userId: message.author.id,
            channelId: message.channel.id,
            initialMessage: message, // The media message is always the anchor.
            mediaUrls: message.attachments.map(att => att.url),
            detectedDays,
            confidence,
            evaluationTimer: setTimeout(() => {}, 0), // Placeholder.
          };
        } else {
          // This is a text-only message and there's no active session. Ignore it.
          return;
        }
      }
  
      // Set/reset the main session timer and store the session.
      session.evaluationTimer = setTimeout(
        () => this.onSessionTimeout(session!.userId),
        this.SESSION_LIFETIME_MS,
      );
      this.sessions.set(message.author.id, session);
  
      // Evaluate immediately.
      await this.evaluateSession(session);
    }
  
    /**
     * Evaluates the current state of a session and takes appropriate action.
     * This includes archiving, prompting admins, or waiting for more info.
     * @param session The user's active archive session.
     */
    private async evaluateSession(session: ArchiveSession): Promise<void> {
      const {detectedDays, confidence, initialMessage} = session;
  
      // Case: Complete Session (Happy Path or Benign Duplicate).
      if (detectedDays.length === 1 && confidence === 'high') {
        const day = detectedDays[0];
  
        // Duplicate Check.
        if (day && this.posts.findByDay(day)) {
          this.client.logger.warn(`Benign Duplicate: Day ${day} already exists.`);
          await initialMessage.react('⚠️');
          this.cleanupSession(session.userId);
          return;
        }
  
        // Sequence Check.
        const latestDay = this.posts.getMaxDay() ?? 0;
        const expectedDay = latestDay + 1;
        if (day !== expectedDay) {
          await this.promptForOutOfSequence(session, expectedDay);
          // Don't clean up session; wait for admin response.
          return;
        }
  
        // All checks passed, archive it.
        await this.archivePost(session, day);
        await initialMessage.react('✅');
        this.cleanupSession(session.userId);
        return;
      }
  
      // Case: Ambiguous Multi-Day Post.
      if (detectedDays.length > 1) {
        await this.promptForAmbiguous(session);
        this.cleanupSession(session.userId); // Fail safely, require manual command.
        return;
      }
  
      // Case: Typo / Unclear Format (Low Confidence).
      if (detectedDays.length === 1 && confidence === 'low') {
        await this.promptForLowConfidence(session);
        // Don't clean up; wait for admin response.
        return;
      }
  
      // Case: Partial Session (Media-Only, so far).
      // Reset the shorter media-only timer. If it fires, we prompt.
      clearTimeout(session.evaluationTimer);
      session.evaluationTimer = setTimeout(
        () => this.onMediaOnlyTimeout(session.userId),
        this.MEDIA_ONLY_PROMPT_DELAY_MS,
      );
      this.sessions.set(session.userId, session); // Save updated timer.
    }
  
    /**
     * Archives a post and its media to the database.
     * @param session The session containing the post details.
     * @param day The confirmed day number for the archive.
     */
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
        this.client.logger.info(
          {day, messageId: session.initialMessage.id},
          'Successfully archived post.',
        );
      } else {
        this.client.logger.error(
          {day, messageId: session.initialMessage.id},
          'Failed to archive post.',
        );
        await session.initialMessage.react('❌');
      }
    }
  
    // --- Admin Prompts ---
  
    private async promptForOutOfSequence(
      session: ArchiveSession,
      expectedDay: number,
    ) {
      const day = session.detectedDays[0];
      const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`force_archive_${session.initialMessage.id}_${day}`)
          .setLabel(`Force Archive as Day ${day}`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`ignore_post_${session.initialMessage.id}`)
          .setLabel('Ignore This Post')
          .setStyle(ButtonStyle.Secondary),
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
          .setStyle(ButtonStyle.Secondary),
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
          .setStyle(ButtonStyle.Secondary),
      );
      const content = `I saw a new photo from Johan with no day information. Is this a Daily Johan archive? ([Original Message](${session.initialMessage.url}))`;
      await this.notifyAdmins(content, [buttons]);
    }
  
    // --- Timeout Handlers ---
  
    private onSessionTimeout(userId: string): void {
      const session = this.sessions.get(userId);
      if (session) {
        this.client.logger.info(
          `Session for user ${userId} timed out and is being cleaned up.`,
        );
        this.cleanupSession(userId);
      }
    }
  
    private onMediaOnlyTimeout(userId: string): void {
      const session = this.sessions.get(userId);
      if (session && session.detectedDays.length === 0) {
        this.client.logger.info(
          `Media-only session for ${userId} detected. Prompting admin.`,
        );
        this.promptForMediaOnly(session);
      }
      // The session is now stale and should be closed regardless.
      this.cleanupSession(userId);
    }
  
    // --- Interaction Handlers ---
  
    /**
     * Handles button interactions related to archiving prompts.
     * @param interaction The button interaction from an admin.
     */
    public async handleInteraction(interaction: ButtonInteraction) {
      const [action, messageId, dayStr] = interaction.customId.split('_');
      const session = this.findSessionByMessageId(messageId ?? '');
  
      if (!session && !['force_archive', 'confirm_archive'].includes(action ?? '')) {
        await interaction.update({
          content: 'This interaction has expired as the original context is gone.',
          components: [],
        });
        return;
      }
  
      switch (action) {
        case 'force_archive':
        case 'confirm_archive': {
          // We can reconstruct a temporary session if the original expired.
          const day = parseInt(dayStr ?? '0', 10);
          const tempSession =
            session ??
            (await this.recreateSessionFromMessage(
              messageId ?? '',
              interaction.channel as TextChannel,
            ));
          if (!tempSession) {
            await interaction.update({
              content: 'Error: Could not find the original message to archive.',
              components: [],
            });
            return;
          }
          await this.archivePost(tempSession, day);
          await interaction.update({
            content: `✅ Action Confirmed. Post has been archived as Day ${day}.`,
            components: [],
          });
          tempSession.initialMessage
            .react('✅')
            .catch(e =>
              this.client.logger.warn("Couldn't react to original message", e),
            );
          break;
        }
        case 'ignore_post':
          if (session) this.cleanupSession(session.userId);
          await interaction.update({
            content: 'OK, this post will be ignored.',
            components: [],
          });
          break;
        case 'add_day_info': {
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
    }
  
    /**
     * Handles modal submissions for adding day info to a media-only post.
     * @param interaction The modal submission interaction from an admin.
     */
    public async handleModalSubmit(interaction: ModalSubmitInteraction) {
      const [_, messageId] = interaction.customId.split('_');
      const dayString = interaction.fields.getTextInputValue('day_input');
      const day = parseInt(dayString, 10);
  
      if (isNaN(day) || day < 1) {
        await interaction.reply({
          content: 'Error: Invalid day number.',
          ephemeral: true,
        });
        return;
      }
  
      if (this.posts.findByDay(day)) {
        await interaction.reply({
          content: `Error: Day ${day} already exists in the archive.`,
          ephemeral: true,
        });
        return;
      }
  
      const session = await this.recreateSessionFromMessage(
        messageId ?? '',
        interaction.channel as TextChannel,
      );
      if (!session) {
        await interaction.reply({
          content: 'Error: Could not find the original message.',
          ephemeral: true,
        });
        return;
      }
  
      await this.archivePost(session, day);
      await interaction.reply({
        content: `✅ Success! Post has been archived as Day ${day}.`,
        ephemeral: true,
      });
      session.initialMessage
        .react('✅')
        .catch(e =>
          this.client.logger.warn("Couldn't react to original message", e),
        );
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
  
    private async recreateSessionFromMessage(
      messageId: string,
      channel: TextChannel | null,
    ): Promise<ArchiveSession | null> {
      if (!channel) return null;
      try {
        const message = await channel.messages.fetch(messageId);
        return {
          userId: message.author.id,
          channelId: channel.id,
          initialMessage: message,
          mediaUrls: message.attachments.map(a => a.url),
          // These don't matter for a recreated session, as the action is already decided.
          detectedDays: [],
          confidence: 'none',
          evaluationTimer: setTimeout(() => {}, 0),
        };
      } catch (error) {
        this.client.logger.error(
          {err: error, messageId},
          'Failed to fetch message for session recreation',
        );
        return null;
      }
    }
  
    private async notifyAdmins(
      content: string,
      components: ActionRowBuilder<ButtonBuilder>[] = [],
    ): Promise<void> {
      // This logic sends a notification to the first available channel an admin can see.
      // A dedicated, configured admin channel would be more robust.
      for (const guild of this.client.guilds.cache.values()) {
        try {
          const adminRole = await guild.roles.fetch(config.ADMIN_ROLE_ID);
          if (!adminRole) continue;
  
          const channel = guild.channels.cache.find(
            c =>
              c.type === ChannelType.GuildText &&
              c.permissionsFor(adminRole)?.has('ViewChannel'),
          ) as TextChannel | undefined;
  
          if (channel) {
            await channel.send({
              content: `<@&${config.ADMIN_ROLE_ID}> ${content}`,
              components,
            });
            this.client.logger.info(
              `Sent admin notification to channel ${channel.id}`,
            );
            return; // Sent successfully.
          }
        } catch (error) {
          this.client.logger.error(
            {err: error, guildId: guild.id},
            'Failed to send admin notification.',
          );
        }
      }
      this.client.logger.error(
        'Could not find any suitable channel to send an admin notification.',
      );
    }
  }