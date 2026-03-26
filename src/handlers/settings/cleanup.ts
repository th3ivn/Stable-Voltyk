import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { findUserWithRelations, updateNotificationSettings } from "../../db/queries/users.js";
import { cleanupKeyboard } from "../../keyboards/inline.js";
import { cleanupMessage } from "../../formatters/messages.js";

export function registerCleanupHandlers(bot: Bot<BotContext>): void {
  bot.callbackQuery("settings_cleanup", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    await showCleanup(ctx, data);
  });

  bot.callbackQuery("cleanup_toggle_commands", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const current = data.notificationSettings?.autoDeleteCommands ?? false;
    await updateNotificationSettings(ctx.db, data.user.id, { autoDeleteCommands: !current });

    const refreshed = await findUserWithRelations(ctx.db, telegramId);
    if (refreshed === null) return;
    await showCleanup(ctx, refreshed);
  });

  bot.callbackQuery("cleanup_toggle_messages", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const current = data.notificationSettings?.autoDeleteBotMessages ?? false;
    await updateNotificationSettings(ctx.db, data.user.id, { autoDeleteBotMessages: !current });

    const refreshed = await findUserWithRelations(ctx.db, telegramId);
    if (refreshed === null) return;
    await showCleanup(ctx, refreshed);
  });
}

async function showCleanup(
  ctx: BotContext,
  data: NonNullable<Awaited<ReturnType<typeof findUserWithRelations>>>,
): Promise<void> {
  const ns = data.notificationSettings;
  const text = cleanupMessage({
    autoDeleteCommands: ns?.autoDeleteCommands ?? false,
    autoDeleteBotMessages: ns?.autoDeleteBotMessages ?? false,
  });

  await ctx.editMessageText(text, {
    reply_markup: cleanupKeyboard({
      autoDeleteCommands: ns?.autoDeleteCommands ?? false,
      autoDeleteBotMessages: ns?.autoDeleteBotMessages ?? false,
    }),
  });
}
