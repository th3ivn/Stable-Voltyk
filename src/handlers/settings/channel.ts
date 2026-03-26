import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { findUserWithRelations, updateChannelConfig } from "../../db/queries/users.js";
import {
  channelNoChannelKeyboard,
  channelWithChannelKeyboard,
  channelConnectInstructionKeyboard,
  channelInfoKeyboard,
} from "../../keyboards/inline.js";
import {
  channelSettingsMessage,
  channelConnectInstructionMessage,
  channelInfoMessage,
} from "../../formatters/messages.js";

export function registerChannelSettingsHandlers(bot: Bot<BotContext>): void {
  // Settings → Channel
  bot.callbackQuery("settings_channel", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const hasChannel =
      data.channelConfig?.channelId != null && data.channelConfig.channelId.length > 0;

    const text = channelSettingsMessage({
      hasChannel,
      channelTitle: data.channelConfig?.channelTitle,
    });

    if (hasChannel) {
      await ctx.editMessageText(text, {
        reply_markup: channelWithChannelKeyboard({
          isPublic: false,
        }),
      });
    } else {
      await ctx.editMessageText(text, {
        reply_markup: channelNoChannelKeyboard(),
      });
    }
  });

  // Channel info
  bot.callbackQuery("channel_info", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const cc = data.channelConfig;
    if (cc?.channelId == null || cc.channelId.length === 0) {
      await ctx.editMessageText("❌ Канал не підключено.", {
        reply_markup: channelInfoKeyboard(),
      });
      return;
    }

    await ctx.editMessageText(
      channelInfoMessage({
        channelId: cc.channelId,
        channelTitle: cc.channelTitle,
        channelDescription: cc.channelDescription,
        channelStatus: cc.channelStatus ?? "active",
        channelPaused: cc.channelPaused ?? false,
      }),
      { parse_mode: "HTML", reply_markup: channelInfoKeyboard() },
    );
  });

  // Connect channel — show instruction
  bot.callbackQuery("channel_connect", async (ctx) => {
    await ctx.answerCallbackQuery();
    const botUsername = ctx.me?.username ?? "bot";
    await ctx.editMessageText(channelConnectInstructionMessage(botUsername), {
      parse_mode: "HTML",
      reply_markup: channelConnectInstructionKeyboard(),
    });
  });

  // Pause channel
  bot.callbackQuery("channel_pause", async (ctx) => {
    await ctx.answerCallbackQuery("⏸ Канал зупинено");
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    await updateChannelConfig(ctx.db, data.user.id, { channelPaused: true });

    const { showMainMenu } = await import("../start.js");
    await showMainMenu(ctx, data.user.id);
  });

  // Resume channel
  bot.callbackQuery("channel_resume", async (ctx) => {
    await ctx.answerCallbackQuery("▶️ Канал відновлено");
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    await updateChannelConfig(ctx.db, data.user.id, { channelPaused: false });

    const { showMainMenu } = await import("../start.js");
    await showMainMenu(ctx, data.user.id);
  });

  // Disconnect channel
  bot.callbackQuery("channel_disconnect", async (ctx) => {
    await ctx.answerCallbackQuery("🔴 Канал відключено");
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    await updateChannelConfig(ctx.db, data.user.id, {
      channelId: null,
      channelTitle: null,
      channelDescription: null,
      channelPhotoFileId: null,
      channelStatus: "disconnected",
      channelPaused: false,
    });

    const { showMainMenu } = await import("../start.js");
    await showMainMenu(ctx, data.user.id);
  });
}
