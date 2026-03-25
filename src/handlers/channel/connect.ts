import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import {
  findUserByTelegramId,
  findPendingChannel,
  deletePendingChannel,
  updateChannelConfig,
} from "../../db/queries/users.js";

export function registerChannelConnectHandlers(bot: Bot<BotContext>): void {
  // Confirm pending channel connection
  bot.callbackQuery(/^pending_channel_confirm_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const matchStr = ctx.match[1];
    if (matchStr === undefined) return;
    const pendingId = parseInt(matchStr, 10);
    if (isNaN(pendingId)) return;

    const pending = await findPendingChannel(ctx.db, pendingId);
    if (pending === null) {
      await ctx.editMessageText("❌ Канал не знайдено або вже підключено.");
      return;
    }

    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null || user.id !== pending.userId) return;

    // Activate channel
    await updateChannelConfig(ctx.db, user.id, {
      channelId: pending.channelId,
      channelTitle: pending.channelTitle,
      channelStatus: "active",
      channelPaused: false,
    });

    // Remove pending entry
    await deletePendingChannel(ctx.db, pendingId);

    await ctx.editMessageText(
      `✅ Канал "${pending.channelTitle}" успішно підключено!`,
    );

    // Show main menu
    const { showMainMenu } = await import("../start.js");
    await showMainMenu(ctx, user.id);
  });

  // Reject pending channel
  bot.callbackQuery(/^pending_channel_reject_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const matchStr = ctx.match[1];
    if (matchStr === undefined) return;
    const pendingId = parseInt(matchStr, 10);
    if (isNaN(pendingId)) return;

    const pending = await findPendingChannel(ctx.db, pendingId);
    if (pending === null) {
      await ctx.editMessageText("❌ Канал не знайдено.");
      return;
    }

    await deletePendingChannel(ctx.db, pendingId);
    await ctx.editMessageText("👌 Канал не підключено.");
  });
}
