import type { Bot } from "grammy";
import type { BotContext } from "../bot.js";
import { allAdminIds } from "../config.js";
import { logger } from "../utils/logger.js";

// ============================================================
// Module state
// ============================================================

let bot: Bot<BotContext> | null = null;

// ============================================================
// Public API
// ============================================================

/**
 * Initialize admin notifications with a bot instance.
 * Must be called before notifyAdmins().
 */
export function initAdminNotify(botInstance: Bot<BotContext>): void {
  bot = botInstance;
}

/**
 * Send a notification message to all admin users.
 *
 * Called on:
 * - Bot started / stopped
 * - Circuit breaker opened / closed
 * - DB connection lost / restored
 * - GitHub API rate limited
 * - Unhandled error in handler (with Sentry event ID)
 * - Retry queue overflow (message dropped after MAX_ATTEMPTS)
 * - Scheduler job failed
 */
export async function notifyAdmins(
  message: string,
  level: "info" | "warn" | "error" = "info",
): Promise<void> {
  if (bot === null) {
    logger.warn("notifyAdmins called before bot initialized, skipping");
    return;
  }

  const emoji = { info: "ℹ️", warn: "⚠️", error: "🚨" };
  const text =
    `${emoji[level]} <b>Voltyk Bot</b>\n\n` +
    `${message}\n\n` +
    `<i>${new Date().toISOString()}</i>`;

  for (const adminId of allAdminIds) {
    try {
      await bot.api.sendMessage(adminId, text, { parse_mode: "HTML" });
    } catch (err) {
      logger.warn({ adminId, error: err }, "Failed to notify admin");
    }
  }
}
