import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { findUserWithRelations, updateChannelConfig } from "../../db/queries/users.js";
import { channelFormatKeyboard } from "../../keyboards/inline.js";
import { channelFormatMessage } from "../../formatters/messages.js";

export function registerChannelFormatHandlers(bot: Bot<BotContext>): void {
  // Show format settings
  bot.callbackQuery("channel_format", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    await showFormat(ctx, data);
  });

  // Toggle picture only
  bot.callbackQuery("channel_toggle_picture_only", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const current = data.channelConfig?.pictureOnly ?? false;
    await updateChannelConfig(ctx.db, data.user.id, { pictureOnly: !current });

    const refreshed = await findUserWithRelations(ctx.db, telegramId);
    if (refreshed === null) return;
    await showFormat(ctx, refreshed);
  });

  // Toggle delete old message
  bot.callbackQuery("channel_toggle_delete_old", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const current = data.channelConfig?.deleteOldMessage ?? false;
    await updateChannelConfig(ctx.db, data.user.id, { deleteOldMessage: !current });

    const refreshed = await findUserWithRelations(ctx.db, telegramId);
    if (refreshed === null) return;
    await showFormat(ctx, refreshed);
  });
}

async function showFormat(
  ctx: BotContext,
  data: NonNullable<Awaited<ReturnType<typeof findUserWithRelations>>>,
): Promise<void> {
  const cc = data.channelConfig;
  const text = channelFormatMessage({
    pictureOnly: cc?.pictureOnly ?? false,
    deleteOldMessage: cc?.deleteOldMessage ?? false,
  });

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: channelFormatKeyboard({
      pictureOnly: cc?.pictureOnly ?? false,
      deleteOldMessage: cc?.deleteOldMessage ?? false,
    }),
  });
}
