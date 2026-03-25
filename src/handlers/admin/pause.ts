import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { isAdmin } from "../../config.js";
import { getSettingBool, setSetting } from "../../db/queries/settings.js";
import { addPauseLogEntry } from "../../db/queries/admin.js";
import { adminPauseKeyboard } from "../../keyboards/inline.js";
import { adminPauseMessage } from "../../formatters/messages.js";
import { logger } from "../../utils/logger.js";

export function registerAdminPauseHandlers(bot: Bot<BotContext>): void {
  // Show pause status — this is accessed via admin_maintenance → pause
  // Or we can add a direct "pause" concept separate from maintenance
  // For now: bot_paused setting controls whether the bot processes non-admin updates

  bot.callbackQuery("admin_router", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    const isPaused = await getSettingBool(ctx.db, "bot_paused", false);
    await ctx.editMessageText(adminPauseMessage(isPaused), {
      parse_mode: "HTML",
      reply_markup: adminPauseKeyboard(isPaused),
    });
  });

  // Pause bot
  bot.callbackQuery("admin_pause_on", async (ctx) => {
    await ctx.answerCallbackQuery("⏸ Бота поставлено на паузу");
    if (!isAdmin(ctx.from.id)) return;

    await setSetting(ctx.db, "bot_paused", "true");
    await addPauseLogEntry(ctx.db, ctx.from.id, "pause");
    logger.info({ adminId: ctx.from.id }, "Bot paused by admin");

    await ctx.editMessageText(adminPauseMessage(true), {
      parse_mode: "HTML",
      reply_markup: adminPauseKeyboard(true),
    });
  });

  // Resume bot
  bot.callbackQuery("admin_pause_off", async (ctx) => {
    await ctx.answerCallbackQuery("▶️ Бота відновлено");
    if (!isAdmin(ctx.from.id)) return;

    await setSetting(ctx.db, "bot_paused", "false");
    await addPauseLogEntry(ctx.db, ctx.from.id, "resume");
    logger.info({ adminId: ctx.from.id }, "Bot resumed by admin");

    await ctx.editMessageText(adminPauseMessage(false), {
      parse_mode: "HTML",
      reply_markup: adminPauseKeyboard(false),
    });
  });
}
