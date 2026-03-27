import { Cron } from "croner";
import type { Bot } from "grammy";
import type { BotContext } from "../bot.js";
import type { Database } from "../db/client.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { getUsersWithIp } from "../db/queries/users.js";
import {
  getScheduleCheck,
  upsertScheduleCheck,
  upsertSnapshot,
  addScheduleHistory,
  cleanOldReminders,
  hasReminderBeenSent,
  markReminderSent,
} from "../db/queries/schedule.js";
import {
  getScheduleData,
  parseScheduleForQueue,
  calculateScheduleHash,
  checkForUpdates,
  findNextEvent,
} from "./api.js";
import { runPingCycle } from "./power-monitor.js";
import { formatScheduleMessage, type ScheduleEvent } from "../formatters/schedule.js";
import { nowKyiv, formatDateKyiv, getDayNameKyiv } from "../utils/helpers.js";
import { increment } from "./metrics.js";
import { notifyAdmins } from "./admin-notify.js";

// ============================================================
// Module state
// ============================================================

const jobs: Cron[] = [];
let db: Database | null = null;
let bot: Bot<BotContext> | null = null;
let isRunning = false;

// ============================================================
// Public API
// ============================================================

/**
 * Start all scheduled jobs.
 */
export function startScheduler(database: Database, botInstance: Bot<BotContext>): void {
  db = database;
  bot = botInstance;
  isRunning = true;

  // 1. Schedule check (every N seconds, configurable)
  const scheduleIntervalS = config.SCHEDULE_CHECK_INTERVAL_S;
  if (scheduleIntervalS > 0) {
    const cronExpr = `*/${Math.max(scheduleIntervalS, 10)} * * * * *`;
    jobs.push(
      new Cron(cronExpr, { timezone: "Europe/Kyiv", protect: true }, () => {
        void runScheduleCheck().catch((err: unknown) => {
          logger.error({ error: err }, "Schedule check job failed");
          increment("errors");
          void notifyAdmins(`Schedule check job failed: ${err instanceof Error ? err.message : String(err)}`, "error");
        });
      }),
    );
    logger.info({ intervalS: scheduleIntervalS }, "Schedule check job started");
  }

  // 2. Power ping check (every N seconds, configurable)
  const powerIntervalS = config.POWER_CHECK_INTERVAL_S;
  if (powerIntervalS > 0) {
    const cronExpr = `*/${Math.max(powerIntervalS, 10)} * * * * *`;
    jobs.push(
      new Cron(cronExpr, { timezone: "Europe/Kyiv", protect: true }, () => {
        void runPowerCheck().catch((err: unknown) => {
          logger.error({ error: err }, "Power check job failed");
          increment("errors");
          void notifyAdmins(`Power check job failed: ${err instanceof Error ? err.message : String(err)}`, "error");
        });
      }),
    );
    logger.info({ intervalS: powerIntervalS }, "Power check job started");
  }

  // 3. Reminders check (every minute)
  jobs.push(
    new Cron("0 * * * * *", { timezone: "Europe/Kyiv", protect: true }, () => {
      void runReminderCheck().catch((err: unknown) => {
        logger.error({ error: err }, "Reminder check job failed");
      });
    }),
  );
  logger.info("Reminder check job started (every minute)");

  // 4. Daily cleanup at 03:00 Kyiv time
  jobs.push(
    new Cron("0 0 3 * * *", { timezone: "Europe/Kyiv" }, () => {
      void runDailyCleanup().catch((err: unknown) => {
        logger.error({ error: err }, "Daily cleanup job failed");
      });
    }),
  );
  logger.info("Daily cleanup job started (03:00 Kyiv)");

  // 5. Daily schedule notification at 06:00 Kyiv time
  jobs.push(
    new Cron("0 0 6 * * *", { timezone: "Europe/Kyiv" }, () => {
      void runMorningNotification().catch((err: unknown) => {
        logger.error({ error: err }, "Morning notification job failed");
      });
    }),
  );
  logger.info("Morning notification job started (06:00 Kyiv)");

  logger.info({ jobCount: jobs.length }, "Scheduler started");
}

/**
 * Stop all scheduled jobs gracefully.
 */
export function stopScheduler(): void {
  isRunning = false;
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
  logger.info("Scheduler stopped");
}

/**
 * Get scheduler status for health check.
 */
export function getSchedulerStatus(): { isRunning: boolean; jobCount: number } {
  return { isRunning, jobCount: jobs.length };
}

// ============================================================
// Job: Schedule check
// ============================================================

async function runScheduleCheck(): Promise<void> {
  if (db === null || bot === null || !isRunning) return;

  increment("scheduleChecks");

  // Check if there are updates via GitHub commits API
  const hasUpdates = await checkForUpdates();
  if (!hasUpdates) return;

  logger.info("Schedule data updated, checking for changes...");

  // Get all unique region+queue combos from active users
  const users = await getUsersWithIp(db);
  // Actually we need ALL active users, not just those with IP
  // getUsersWithIp returns all active users (just filtering isActive)

  const regionQueues = new Map<string, Set<string>>();
  for (const u of users) {
    const queues = regionQueues.get(u.region) ?? new Set<string>();
    queues.add(u.queue);
    regionQueues.set(u.region, queues);
  }

  for (const [region, queues] of regionQueues) {
    const data = await getScheduleData(region);
    if (data === null) continue;

    for (const queue of queues) {
      await processScheduleForQueue(region, queue, data);
    }
  }
}

async function processScheduleForQueue(
  region: string,
  queue: string,
  data: Awaited<ReturnType<typeof getScheduleData>>,
): Promise<void> {
  if (db === null || bot === null || data === null) return;

  const parsed = parseScheduleForQueue(data, queue);
  const newHash = calculateScheduleHash(parsed.today);

  // Check if changed
  const check = await getScheduleCheck(db, region, queue);
  const oldHash = check?.lastHash ?? null;

  const now = new Date();
  await upsertScheduleCheck(db, region, queue, {
    lastHash: newHash,
    lastCheckedAt: now,
    lastChangedAt: oldHash !== newHash ? now : undefined,
  });

  // Save snapshot
  const dateStr = nowKyiv().toISOString().slice(0, 10);
  await upsertSnapshot(db, region, queue, dateStr, JSON.stringify(parsed), newHash);

  if (oldHash !== null && oldHash !== newHash) {
    // Schedule changed — record history and notify users
    await addScheduleHistory(db, region, queue, newHash, JSON.stringify(parsed));
    increment("scheduleChangesDetected");
    logger.info({ region, queue, oldHash, newHash }, "Schedule changed, notifying users");

    await notifyScheduleChange(region, queue, parsed.today);
  }
}

async function notifyScheduleChange(
  region: string,
  queue: string,
  events: ScheduleEvent[],
): Promise<void> {
  if (db === null || bot === null) return;

  const now = nowKyiv();
  const dateStr = formatDateKyiv(now);
  const dayName = getDayNameKyiv(now);

  const totalMinutes = events.reduce((sum, e) => sum + e.durationMinutes, 0);
  const { text, entities } = formatScheduleMessage({
    queue,
    date: dateStr,
    dayName,
    events,
    totalMinutesOff: totalMinutes,
  });

  // Find all users with this region+queue
  // Re-use getUsersWithIp which returns all active users
  const allUsers = await getUsersWithIp(db);
  const targetUsers = allUsers.filter((u) => u.region === region && u.queue === queue);

  let sent = 0;
  for (const user of targetUsers) {
    try {
      await bot.api.sendMessage(user.telegramId, text, { entities });
      sent++;
      // Rate limit: ~25 msg/sec
      if (sent % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      logger.warn(
        { error: err, telegramId: user.telegramId },
        "Failed to send schedule change notification",
      );
    }
  }

  logger.info({ region, queue, sent, total: targetUsers.length }, "Schedule change notifications sent");
}

// ============================================================
// Job: Power ping check
// ============================================================

async function runPowerCheck(): Promise<void> {
  if (!isRunning) return;

  increment("pingChecks");
  const result = await runPingCycle();
  if (result.errors > 0) {
    increment("pingFailures", result.errors);
  }
  if (result.total > 0) {
    logger.debug(
      {
        total: result.total,
        online: result.online,
        offline: result.offline,
        errors: result.errors,
      },
      "Power ping cycle completed",
    );
  }
}

// ============================================================
// Job: Reminder check (15m/30m/1h before events)
// ============================================================

async function runReminderCheck(): Promise<void> {
  if (db === null || bot === null || !isRunning) return;

  const allUsers = await getUsersWithIp(db);
  if (allUsers.length === 0) return;

  // Group users by region+queue
  const groups = new Map<string, typeof allUsers>();
  for (const u of allUsers) {
    const key = `${u.region}:${u.queue}`;
    const group = groups.get(key) ?? [];
    group.push(u);
    groups.set(key, group);
  }

  for (const [key, users] of groups) {
    const [region, queue] = key.split(":");
    if (region === undefined || queue === undefined) continue;

    const data = await getScheduleData(region);
    if (data === null) continue;

    const parsed = parseScheduleForQueue(data, queue);
    const nextEvent = findNextEvent(parsed.today);
    if (nextEvent === null) continue;

    const minutes = nextEvent.minutesUntil;

    // Check for 15m, 30m, 60m windows
    const windows = [
      { minutes: 15, label: "15 хвилин" },
      { minutes: 30, label: "30 хвилин" },
      { minutes: 60, label: "1 годину" },
    ];

    for (const window of windows) {
      // Trigger when within 1 minute of the window
      if (minutes <= window.minutes && minutes > window.minutes - 2) {
        const eventType = nextEvent.type === "off" ? "вимкнення" : "увімкнення";
        const text =
          `⏰ <b>Нагадування</b>\n\n` +
          `${nextEvent.type === "off" ? "🔴" : "🟢"} ${eventType} через ~${window.label}\n` +
          `📅 ${nextEvent.event.start}–${nextEvent.event.end}`;

        const reminderKey = `${nowKyiv().toISOString().slice(0, 10)}:${queue}:${nextEvent.event.start}:${window.minutes}`;

        for (const user of users) {
          try {
            const alreadySent = await hasReminderBeenSent(db, user.id, reminderKey);
            if (alreadySent) continue;

            await bot.api.sendMessage(user.telegramId, text, { parse_mode: "HTML" });
            await markReminderSent(db, user.id, reminderKey);
          } catch (err) {
            logger.warn(
              { error: err, telegramId: user.telegramId },
              "Failed to send reminder",
            );
          }
        }
      }
    }
  }
}

// ============================================================
// Job: Daily cleanup (03:00 Kyiv)
// ============================================================

async function runDailyCleanup(): Promise<void> {
  if (db === null || !isRunning) return;

  logger.info("Running daily cleanup...");
  await cleanOldReminders(db, 48);
  logger.info("Daily cleanup completed");
}

// ============================================================
// Job: Morning notification (06:00 Kyiv)
// ============================================================

async function runMorningNotification(): Promise<void> {
  if (db === null || bot === null || !isRunning) return;

  logger.info("Running morning schedule notification...");

  // Force fresh data
  await checkForUpdates();

  const allUsers = await getUsersWithIp(db);
  const groups = new Map<string, typeof allUsers>();
  for (const u of allUsers) {
    const key = `${u.region}:${u.queue}`;
    const group = groups.get(key) ?? [];
    group.push(u);
    groups.set(key, group);
  }

  let totalSent = 0;

  for (const [key, users] of groups) {
    const [region, queue] = key.split(":");
    if (region === undefined || queue === undefined) continue;

    const data = await getScheduleData(region);
    if (data === null) continue;

    const parsed = parseScheduleForQueue(data, queue);
    if (parsed.today.length === 0) continue; // No outages today, skip

    const now = nowKyiv();
    const dateStr = formatDateKyiv(now);
    const dayName = getDayNameKyiv(now);
    const totalMinutes = parsed.today.reduce((sum, e) => sum + e.durationMinutes, 0);

    const { text, entities } = formatScheduleMessage({
      queue,
      date: dateStr,
      dayName,
      events: parsed.today,
      totalMinutesOff: totalMinutes,
    });

    for (const user of users) {
      try {
        await bot.api.sendMessage(user.telegramId, text, { entities });
        totalSent++;
        if (totalSent % 25 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (err) {
        logger.warn(
          { error: err, telegramId: user.telegramId },
          "Failed to send morning notification",
        );
      }
    }
  }

  logger.info({ totalSent }, "Morning notifications completed");
}
