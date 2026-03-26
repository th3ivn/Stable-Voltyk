import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { findUserByTelegramId, findUserWithRelations, updateUser } from "../../db/queries/users.js";
import { deletePowerState } from "../../db/queries/power.js";
import { isValidIpOrDomain } from "../../utils/helpers.js";
import { pingHost } from "../../services/power-monitor.js";
import {
  ipNoIpKeyboard,
  ipWithIpKeyboard,
  ipConfirmDeleteKeyboard,
} from "../../keyboards/inline.js";
import {
  ipNoIpMessage,
  ipWithIpMessage,
  ipStatusChecking,
  ipStatusOnline,
  ipStatusOffline,
} from "../../formatters/messages.js";

export function registerIpHandlers(bot: Bot<BotContext>): void {
  // Settings → IP
  bot.callbackQuery("settings_ip", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    if (data.user.routerIp != null && data.user.routerIp.length > 0) {
      // Show IP status with ping check
      await ctx.editMessageText(
        ipWithIpMessage(data.user.routerIp, ipStatusChecking()),
        { parse_mode: "HTML", reply_markup: ipWithIpKeyboard() },
      );

      // Async ping check
      try {
        const isOnline = await pingHost(data.user.routerIp);
        await ctx.editMessageText(
          ipWithIpMessage(data.user.routerIp, isOnline ? ipStatusOnline() : ipStatusOffline()),
          { parse_mode: "HTML", reply_markup: ipWithIpKeyboard() },
        );
      } catch {
        await ctx.editMessageText(
          ipWithIpMessage(data.user.routerIp, "❓ Не вдалося перевірити"),
          { parse_mode: "HTML", reply_markup: ipWithIpKeyboard() },
        );
      }
    } else {
      // No IP — show input prompt
      ctx.session.awaitingIpInput = true;
      await ctx.editMessageText(ipNoIpMessage(), {
        parse_mode: "HTML",
        reply_markup: ipNoIpKeyboard(),
      });
    }
  });

  // Cancel IP input
  bot.callbackQuery("ip_cancel_to_settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.awaitingIpInput = false;
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    const { showMainMenu } = await import("../start.js");
    await showMainMenu(ctx, user.id);
  });

  // Change IP (show input prompt)
  bot.callbackQuery("ip_change", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.awaitingIpInput = true;
    await ctx.editMessageText(ipNoIpMessage(), {
      parse_mode: "HTML",
      reply_markup: ipNoIpKeyboard(),
    });
  });

  // Delete IP confirmation
  bot.callbackQuery("ip_delete", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("🗑 Видалити IP-адресу?\n\nМоніторинг світла буде вимкнено.", {
      reply_markup: ipConfirmDeleteKeyboard(),
    });
  });

  // Confirm delete IP
  bot.callbackQuery("ip_confirm_delete", async (ctx) => {
    await ctx.answerCallbackQuery("✅ IP видалено");
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    await updateUser(ctx.db, user.id, { routerIp: null });
    await deletePowerState(ctx.db, telegramId);

    const { showMainMenu } = await import("../start.js");
    await showMainMenu(ctx, user.id);
  });

  // Ping check
  bot.callbackQuery("ip_ping_check", async (ctx) => {
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null || user.routerIp == null) {
      await ctx.answerCallbackQuery("IP не налаштовано");
      return;
    }

    await ctx.answerCallbackQuery("📡 Перевіряю...");

    try {
      const isOnline = await pingHost(user.routerIp);
      await ctx.editMessageText(
        ipWithIpMessage(user.routerIp, isOnline ? ipStatusOnline() : ipStatusOffline()),
        { parse_mode: "HTML", reply_markup: ipWithIpKeyboard() },
      );
    } catch {
      await ctx.editMessageText(
        ipWithIpMessage(user.routerIp, "❓ Не вдалося перевірити"),
        { parse_mode: "HTML", reply_markup: ipWithIpKeyboard() },
      );
    }
  });

  // Text message handler for IP input
  bot.on("message:text", async (ctx, next) => {
    if (ctx.session.awaitingIpInput !== true) {
      await next();
      return;
    }

    const input = ctx.message.text.trim();

    if (!isValidIpOrDomain(input)) {
      await ctx.reply(
        "❌ Невірний формат. Введіть IP-адресу або домен.\n\nПриклади:\n192.168.1.1\n192.168.1.1:80\nmyhome.ddns.net",
        { reply_markup: ipNoIpKeyboard() },
      );
      return;
    }

    ctx.session.awaitingIpInput = false;

    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    await updateUser(ctx.db, user.id, { routerIp: input });

    // Show IP with ping
    const msg = await ctx.reply(
      ipWithIpMessage(input, ipStatusChecking()),
      { parse_mode: "HTML", reply_markup: ipWithIpKeyboard() },
    );

    try {
      const isOnline = await pingHost(input);
      await ctx.api.editMessageText(
        ctx.chat.id,
        msg.message_id,
        ipWithIpMessage(input, isOnline ? ipStatusOnline() : ipStatusOffline()),
        { parse_mode: "HTML", reply_markup: ipWithIpKeyboard() },
      );
    } catch {
      // Ignore edit errors
    }
  });
}

