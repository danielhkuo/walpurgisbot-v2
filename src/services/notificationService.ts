// src/services/notificationService.ts
import { CronJob } from 'cron';
import { ChannelType } from 'discord.js';
import type { Client } from 'discord.js';
import type { SettingsRepository } from '../database/settingsRepository';
import type { PostRepository } from '../database/postRepository';
import type { NotificationSettings } from '../types/database';
import { subDays } from 'date-fns';
import { format, toZonedTime } from 'date-fns-tz';

import { config } from '../config';

/**
 * Manages scheduled tasks like daily reminders and reports.
 * This service is robust against bot downtime via "catch-up" logic.
 *
 * Reminder Sending Policy:
 * To prevent duplicate notifications, this service follows an "at-most-once"
 * delivery strategy with a retry window. It works as follows:
 * 1. The database is marked *before* attempting to send a notification.
 * 2. If the notification sends successfully, the state is persisted.
 * 3. If the send fails (e.g., Discord API outage), the database change is
 *    reverted.
 * This ensures that the next time the check runs (e.g., after a bot restart),
 * it will automatically retry sending the missed notification.
 */
export class NotificationService {
  private client: Client;
  private settingsRepo: SettingsRepository;
  private postRepo: PostRepository;
  private reminderJob: CronJob | null = null;
  private settings: NotificationSettings | null = null;

  constructor(
    client: Client,
    settingsRepo: SettingsRepository,
    postRepo: PostRepository,
  ) {
    this.client = client;
    this.settingsRepo = settingsRepo;
    this.postRepo = postRepo;
  }

  /**
   * Initializes the service, fetches settings, runs catch-up logic,
   * and schedules initial jobs.
   */
  public async initialize() {
    this.client.logger.info('Initializing NotificationService...');
    this.settings = this.settingsRepo.getSettings();
    
    // Run catch-up logic BEFORE scheduling the next job.
    await this.runCatchUpChecks();

    this.scheduleJobs();
  }

  /**
   * Fetches the latest settings and reschedules all jobs.
   */
  public rescheduleJobs() {
    this.client.logger.info('Rescheduling notification jobs...');
    this.settings = this.settingsRepo.getSettings();

    if (this.reminderJob) {
      this.reminderJob.stop();
      this.reminderJob = null;
    }

    this.scheduleJobs();
  }

  /**
   * Schedules the daily reminder job based on current settings.
   */
  private scheduleJobs() {
    if (
      !this.settings?.reminder_enabled ||
      !this.settings.reminder_time ||
      !this.settings.timezone
    ) {
      this.client.logger.info(
        'Daily reminder is disabled or not fully configured. Skipping schedule.',
      );
      return;
    }

    const [hour, minute] = this.settings.reminder_time.split(':');
    const cronTime = `${minute} ${hour} * * *`;

    this.reminderJob = new CronJob(
      cronTime,
      () => { void this.runDailyReminderCheck(); },
      null,
      true,
      this.settings.timezone,
    );

    this.client.logger.info({
        cronTime,
        timezone: this.settings.timezone,
        nextRun: this.reminderJob.nextDate().toISO?.() ?? this.reminderJob.nextDate().toString()
      },
      `Daily reminder scheduled.`
    );
  }
  
  /**
   * Checks if a scheduled job was missed during bot downtime and runs it.
   */
  private async runCatchUpChecks() {
    this.client.logger.info('Running catch-up checks for missed jobs...');
    if (
      !this.settings?.reminder_enabled ||
      !this.settings.reminder_time ||
      !this.settings.timezone
    ) {
        return; // Nothing to catch up on.
    }

    const { reminder_time, timezone, last_reminder_check_timestamp } = this.settings;
    const [hour, minute] = reminder_time.split(':').map(Number) as [number, number];
    
    const now = new Date();
    let lastExpectedRunTime = toZonedTime(now, timezone);
    lastExpectedRunTime.setHours(hour, minute, 0, 0);

    // If the expected run time for today is in the future, the last expected run was yesterday.
    if (lastExpectedRunTime > now) {
      lastExpectedRunTime = subDays(lastExpectedRunTime, 1);
    }
    
    const lastExpectedRunTimestamp = Math.floor(lastExpectedRunTime.getTime() / 1000);
    const lastActualRunTimestamp = last_reminder_check_timestamp ?? 0;

    if (lastExpectedRunTimestamp > lastActualRunTimestamp) {
        this.client.logger.warn({
            lastExpectedRun: new Date(lastExpectedRunTimestamp * 1000).toISOString(),
            lastActualRun: new Date(lastActualRunTimestamp * 1000).toISOString()
        }, 'Missed daily reminder check detected. Running catch-up job.');
        await this.runDailyReminderCheck();
    } else {
        this.client.logger.info('No missed jobs detected.');
    }
  }

  /**
   * The core logic for the daily reminder, executed by CronJob or catch-up.
   * Checks if a post is missing for the current day and sends a notification.
   */
  private async runDailyReminderCheck() {
    const runTimestamp = Math.floor(Date.now() / 1000);
    this.client.logger.info('Running daily missing archive check...');

    const timezone = this.settings?.timezone ?? config.TIMEZONE ?? 'UTC';
    const channelId = this.settings?.notification_channel_id ?? config.DEFAULT_CHANNEL_ID;

    if (!channelId) {
        this.client.logger.warn('Cannot run reminder: No notification channel is configured.');
        return;
    }

    const maxDay = this.postRepo.getMaxDay();
    if (!maxDay) {
        this.client.logger.info('No posts in archive. Skipping reminder.');
        return;
    }

    const latestPost = this.postRepo.findByDay(maxDay);
    if (!latestPost) {
        this.client.logger.error({ day: maxDay }, 'Could not find post for maxDay. Data inconsistency?');
        return;
    }
    
    const nowInTimezone = toZonedTime(new Date(), timezone);
    const lastPostDateInTimezone = toZonedTime(new Date(latestPost.post.timestamp * 1000), timezone);
    
    const isPostFromPreviousDay = format(nowInTimezone, 'yyyy-MM-dd') > format(lastPostDateInTimezone, 'yyyy-MM-dd');

    if (isPostFromPreviousDay) {
        const expectedDay = maxDay + 1;

        // Check if we've already sent a reminder for this *specific missing day*.
        if (this.settings?.last_reminder_sent_day === expectedDay) {
            this.client.logger.info(`Reminder for missing Day ${expectedDay} was already sent. Skipping.`);
            return;
        }

        const channel = await this.client.channels.fetch(channelId);
        if (!channel || channel.type !== ChannelType.GuildText) {
            this.client.logger.warn(`Reminder failed: Channel ${channelId} not found or is not a text channel.`);
            return;
        }

        // Store previous state in case of failure, enabling a retry.
        const previousSentDay = this.settings?.last_reminder_sent_day;

        // Mark that we are *about to* send a reminder for the missing day.
        this.settingsRepo.updateSettings({ last_reminder_sent_day: expectedDay });
        this.settings = this.settingsRepo.getSettings(); // Refresh local settings cache

        try {
            const message = this.client.dialogueService.get('notification.reminder.missingDay', {
                maxDay, expectedDay
            });
            await channel.send(message);
            this.client.logger.info(`Sent reminder for missing Day ${expectedDay}.`);
        } catch (sendError) {
            this.client.logger.error({ err: sendError, channelId: channel.id }, 'Failed to send reminder message. Rolling back to allow a retry on the next run.');
            // Roll back the setting to allow a retry on the next scheduled check.
            this.settingsRepo.updateSettings({ last_reminder_sent_day: previousSentDay });
            this.settings = this.settingsRepo.getSettings(); // Re-refresh local cache
            // Re-throw the error to be caught by the global handler
            throw sendError;
        }

    } else {
        this.client.logger.info('Reminder not needed; archive is up-to-date.');
    }

    // CRITICAL: Always update the check timestamp.
    this.settingsRepo.updateSettings({ last_reminder_check_timestamp: runTimestamp });
    this.settings = this.settingsRepo.getSettings(); // Refresh cache
    this.client.logger.info('Finished daily missing archive check.');
  }
}