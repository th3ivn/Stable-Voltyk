import type { Bot } from "grammy";
import type { BotContext } from "../bot.js";
import type { Database } from "../db/client.js";
import { logger } from "../utils/logger.js";
import { updateChannelConfig } from "../db/queries/users.js";
import { eq, isNotNull, and, sql } from "drizzle-orm";
import { users, userChannelConfig } from "../db/schema.js";

// ============================================================
// Types
// ============================================================

interface ChannelBrandingData {
  userId: number;
  telegramId: string;
  channelId: string;
  channelTitle: string | null;
  channelUserTitle: string | null;
  channelUserDescription: string | null;
  channelGuardWarnings: number;
  channelBrandingUpdatedAt: Date | null;
}

// ============================================================
// Public API
// ============================================================

/**
 * Update channel branding (title/description) for all active channels.
 * Adds "⚡" prefix to channel title if not present.
 */
export async function updateAllChannelBranding(
  db: Database,
  bot: Bot<BotContext>,
): Promise<{ updated: number; failed: number }> {
  const channels = await getActiveChannels(db);
  let updated = 0;
  let failed = 0;

  for (const ch of channels) {
    try {
      await updateChannelBranding(db, bot, ch);
      updated++;
    } catch (err) {
      failed++;
      logger.warn(
        { error: err, channelId: ch.channelId, userId: ch.userId },
        "Failed to update channel branding",
      );
    }
  }

  if (updated > 0 || failed > 0) {
    logger.info({ updated, failed }, "Channel branding update completed");
  }

  return { updated, failed };
}

/**
 * Check channel branding guard — verify that channel title/description
 * hasn't been manually changed by someone else.
 */
export async function runChannelGuard(
  db: Database,
  bot: Bot<BotContext>,
): Promise<void> {
  const channels = await getActiveChannels(db);

  for (const ch of channels) {
    try {
      await checkChannelGuard(db, bot, ch);
    } catch (err) {
      logger.warn(
        { error: err, channelId: ch.channelId },
        "Channel guard check failed",
      );
    }
  }
}

// ============================================================
// Internal
// ============================================================

async function getActiveChannels(db: Database): Promise<ChannelBrandingData[]> {
  const rows = await db
    .select({
      userId: userChannelConfig.userId,
      telegramId: users.telegramId,
      channelId: userChannelConfig.channelId,
      channelTitle: userChannelConfig.channelTitle,
      channelUserTitle: userChannelConfig.channelUserTitle,
      channelUserDescription: userChannelConfig.channelUserDescription,
      channelGuardWarnings: userChannelConfig.channelGuardWarnings,
      channelBrandingUpdatedAt: userChannelConfig.channelBrandingUpdatedAt,
    })
    .from(userChannelConfig)
    .innerJoin(users, eq(users.id, userChannelConfig.userId))
    .where(
      and(
        isNotNull(userChannelConfig.channelId),
        sql`length(${userChannelConfig.channelId}) > 0`,
        eq(userChannelConfig.channelPaused, false),
        eq(users.isActive, true),
      ),
    );

  return rows.map((r) => ({
    ...r,
    channelId: r.channelId ?? "",
  }));
}

async function updateChannelBranding(
  db: Database,
  bot: Bot<BotContext>,
  channel: ChannelBrandingData,
): Promise<void> {
  const desiredTitle = channel.channelUserTitle ?? channel.channelTitle;
  if (desiredTitle === null) return;

  // Ensure ⚡ prefix
  const brandedTitle = desiredTitle.startsWith("⚡")
    ? desiredTitle
    : `⚡ ${desiredTitle}`;

  try {
    // Get current channel info
    const chat = await bot.api.getChat(channel.channelId);
    if (chat.type !== "channel") return;

    // Update title if needed
    const currentTitle = chat.title ?? "";
    if (currentTitle !== brandedTitle) {
      await bot.api.setChatTitle(channel.channelId, brandedTitle);
      await updateChannelConfig(db, channel.userId, {
        channelTitle: brandedTitle,
        channelBrandingUpdatedAt: new Date(),
      });
    }

    // Update description if user has custom one
    if (channel.channelUserDescription !== null && channel.channelUserDescription.length > 0) {
      const currentDesc = "description" in chat ? (chat.description ?? "") : "";
      if (currentDesc !== channel.channelUserDescription) {
        await bot.api.setChatDescription(channel.channelId, channel.channelUserDescription);
        await updateChannelConfig(db, channel.userId, {
          channelDescription: channel.channelUserDescription,
          channelBrandingUpdatedAt: new Date(),
        });
      }
    }
  } catch (err) {
    // Not an admin or channel deleted
    logger.warn(
      { error: err, channelId: channel.channelId },
      "Cannot update channel branding",
    );
  }
}

async function checkChannelGuard(
  db: Database,
  bot: Bot<BotContext>,
  channel: ChannelBrandingData,
): Promise<void> {
  try {
    const chat = await bot.api.getChat(channel.channelId);
    if (chat.type !== "channel") return;

    const currentTitle = chat.title ?? "";

    // Check if ⚡ prefix was removed
    if (channel.channelTitle !== null && !currentTitle.startsWith("⚡")) {
      const warnings = channel.channelGuardWarnings + 1;
      await updateChannelConfig(db, channel.userId, {
        channelGuardWarnings: warnings,
      });

      if (warnings <= 3) {
        // Try to restore branding
        try {
          const brandedTitle = currentTitle.startsWith("⚡")
            ? currentTitle
            : `⚡ ${currentTitle}`;
          await bot.api.setChatTitle(channel.channelId, brandedTitle);
          await updateChannelConfig(db, channel.userId, {
            channelTitle: brandedTitle,
          });
        } catch {
          // Can't restore, skip
        }

        // Notify user
        try {
          await bot.api.sendMessage(
            channel.telegramId,
            `⚠️ Назва каналу була змінена. Бот відновив префікс "⚡" для коректної роботи.`,
          );
        } catch {
          // User may have blocked bot
        }
      }
    }
  } catch {
    // Channel may be deleted or bot removed
  }
}
