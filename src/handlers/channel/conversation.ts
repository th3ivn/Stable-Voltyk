import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import {
  findUserByTelegramId,
  findUserWithRelations,
  updateChannelConfig,
} from "../../db/queries/users.js";
import { channelEditInputKeyboard } from "../../keyboards/inline.js";
import {
  channelEditTitleMessage,
  channelEditDescMessage,
} from "../../formatters/messages.js";

export function registerChannelConversationHandlers(bot: Bot<BotContext>): void {
  // Start editing title
  bot.callbackQuery("channel_edit_title", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    ctx.session.awaitingChannelTitle = true;
    ctx.session.awaitingChannelDesc = false;

    await ctx.editMessageText(
      channelEditTitleMessage(data.channelConfig?.channelUserTitle),
      { parse_mode: "HTML", reply_markup: channelEditInputKeyboard() },
    );
  });

  // Start editing description
  bot.callbackQuery("channel_edit_desc", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    ctx.session.awaitingChannelDesc = true;
    ctx.session.awaitingChannelTitle = false;

    await ctx.editMessageText(
      channelEditDescMessage(data.channelConfig?.channelUserDescription),
      { parse_mode: "HTML", reply_markup: channelEditInputKeyboard() },
    );
  });

  // Cancel edit
  bot.callbackQuery("channel_cancel_edit", async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.awaitingChannelTitle = false;
    ctx.session.awaitingChannelDesc = false;

    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    const { showMainMenu } = await import("../start.js");
    await showMainMenu(ctx, user.id);
  });

  // Text handler for title/description input
  bot.on("message:text", async (ctx, next) => {
    const isTitle = ctx.session.awaitingChannelTitle === true;
    const isDesc = ctx.session.awaitingChannelDesc === true;

    if (!isTitle && !isDesc) {
      await next();
      return;
    }

    const input = ctx.message.text.trim();
    if (input.length === 0) {
      await ctx.reply("❌ Текст не може бути порожнім.");
      return;
    }

    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    if (isTitle) {
      if (input.length > 128) {
        await ctx.reply("❌ Назва занадто довга (макс. 128 символів).");
        return;
      }
      ctx.session.awaitingChannelTitle = false;
      await updateChannelConfig(ctx.db, user.id, { channelUserTitle: input });

      // Try to update actual channel title
      const data = await findUserWithRelations(ctx.db, telegramId);
      if (data?.channelConfig?.channelId != null) {
        try {
          await ctx.api.setChatTitle(data.channelConfig.channelId, `⚡ ${input}`);
          await updateChannelConfig(ctx.db, user.id, { channelTitle: `⚡ ${input}` });
        } catch {
          // May not have permission
        }
      }

      await ctx.reply(`✅ Назва оновлена: ${input}`);
    } else {
      if (input.length > 255) {
        await ctx.reply("❌ Опис занадто довгий (макс. 255 символів).");
        return;
      }
      ctx.session.awaitingChannelDesc = false;
      await updateChannelConfig(ctx.db, user.id, { channelUserDescription: input });

      // Try to update actual channel description
      const data = await findUserWithRelations(ctx.db, telegramId);
      if (data?.channelConfig?.channelId != null) {
        try {
          await ctx.api.setChatDescription(data.channelConfig.channelId, input);
          await updateChannelConfig(ctx.db, user.id, { channelDescription: input });
        } catch {
          // May not have permission
        }
      }

      await ctx.reply(`✅ Опис оновлено.`);
    }

    // Return to channel settings
    const { showMainMenu } = await import("../start.js");
    await showMainMenu(ctx, user.id);
  });
}
