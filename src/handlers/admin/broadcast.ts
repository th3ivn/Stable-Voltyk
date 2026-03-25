import type { Bot } from "grammy";
import type { BotContext, SessionData } from "../../bot.js";
import { isAdmin } from "../../config.js";
import { getActiveUserTelegramIds } from "../../db/queries/admin.js";
import {
  adminBroadcastKeyboard,
  adminBroadcastConfirmKeyboard,
  adminBackKeyboard,
} from "../../keyboards/inline.js";
import {
  adminBroadcastPromptMessage,
  adminBroadcastPreviewMessage,
  adminBroadcastResultMessage,
} from "../../formatters/messages.js";
import { logger } from "../../utils/logger.js";

// Extend session with broadcast state
declare module "../../bot.js" {
  interface SessionData {
    awaitingBroadcast?: boolean;
    broadcastText?: string;
  }
}

export function registerAdminBroadcastHandlers(bot: Bot<BotContext>): void {
  // Start broadcast flow
  bot.callbackQuery("admin_broadcast", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    ctx.session.awaitingBroadcast = true;
    ctx.session.broadcastText = undefined;

    await ctx.editMessageText(adminBroadcastPromptMessage(), {
      parse_mode: "HTML",
      reply_markup: adminBroadcastKeyboard(),
    });
  });

  // Cancel broadcast
  bot.callbackQuery("admin_broadcast_cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.awaitingBroadcast = false;
    ctx.session.broadcastText = undefined;

    await ctx.editMessageText("❌ Розсилку скасовано.", {
      reply_markup: adminBackKeyboard(),
    });
  });

  // Confirm and send broadcast
  bot.callbackQuery("admin_broadcast_send", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    const text = ctx.session.broadcastText;
    if (text === undefined || text.length === 0) {
      await ctx.editMessageText("❌ Текст розсилки не знайдено.", {
        reply_markup: adminBackKeyboard(),
      });
      return;
    }

    ctx.session.awaitingBroadcast = false;
    ctx.session.broadcastText = undefined;

    await ctx.editMessageText("📢 Розсилка розпочата...");

    const telegramIds = await getActiveUserTelegramIds(ctx.db);
    let sent = 0;
    let failed = 0;

    for (const tgId of telegramIds) {
      try {
        await ctx.api.sendMessage(tgId, text, { parse_mode: "HTML" });
        sent++;
      } catch (err) {
        failed++;
        logger.warn({ error: err, telegramId: tgId }, "Broadcast send failed");
      }

      // Respect Telegram rate limit (~30 msg/sec)
      if ((sent + failed) % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    await ctx.editMessageText(adminBroadcastResultMessage(sent, failed), {
      parse_mode: "HTML",
      reply_markup: adminBackKeyboard(),
    });

    logger.info({ sent, failed, total: telegramIds.length }, "Broadcast completed");
  });

  // Text handler for broadcast input
  bot.on("message:text", async (ctx, next) => {
    if (ctx.session.awaitingBroadcast !== true) {
      await next();
      return;
    }

    if (!isAdmin(ctx.from.id)) {
      ctx.session.awaitingBroadcast = false;
      await next();
      return;
    }

    const text = ctx.message.text.trim();
    if (text.length === 0) {
      await ctx.reply("❌ Текст не може бути порожнім.");
      return;
    }

    ctx.session.broadcastText = text;

    const telegramIds = await getActiveUserTelegramIds(ctx.db);

    await ctx.reply(adminBroadcastPreviewMessage(text, telegramIds.length), {
      parse_mode: "HTML",
      reply_markup: adminBroadcastConfirmKeyboard(),
    });
  });
}
