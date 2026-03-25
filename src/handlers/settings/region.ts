import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { findUserByTelegramId, updateUser } from "../../db/queries/users.js";
import { getRegionName } from "../../constants/regions.js";
import {
  regionChangeKeyboard,
  queueChangeKeyboard,
  wizardQueueKeyboard,
} from "../../keyboards/inline.js";

export function registerRegionHandlers(bot: Bot<BotContext>): void {
  // Settings → Region
  bot.callbackQuery("settings_region", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    const regionName = getRegionName(user.region);
    const text =
      `📍 Поточний регіон: <b>${regionName}</b>\n` +
      `⚡ Черга: <b>${user.queue}</b>\n\n` +
      `Оберіть новий регіон:`;

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: regionChangeKeyboard(),
    });
  });

  // Select new region
  bot.callbackQuery(/^change_region_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const match = ctx.callbackQuery?.data?.match(/^change_region_(.+)$/);
    const regionCode = match?.[1];
    if (regionCode === undefined) return;

    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    // Save region, show queue selection
    await updateUser(ctx.db, user.id, { region: regionCode });

    const regionName = getRegionName(regionCode);
    const text = `✅ Регіон: ${regionName}\n\n⚡ Оберіть чергу:`;

    await ctx.editMessageText(text, {
      reply_markup: queueChangeKeyboard(regionCode, 1),
    });
  });

  // Queue page navigation (settings context)
  bot.callbackQuery(/^change_queue_page_(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const match = ctx.callbackQuery?.data?.match(/^change_queue_page_(\d+)$/);
    const page = match?.[1];
    if (page === undefined) return;

    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    const regionName = getRegionName(user.region);
    const text = `✅ Регіон: ${regionName}\n\n⚡ Оберіть чергу:`;

    await ctx.editMessageText(text, {
      reply_markup: queueChangeKeyboard(user.region, parseInt(page, 10)),
    });
  });

  // Select new queue (from settings)
  bot.callbackQuery(/^change_queue_(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery("✅ Чергу змінено");
    const match = ctx.callbackQuery?.data?.match(/^change_queue_(.+)$/);
    const queue = match?.[1];
    if (queue === undefined) return;

    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    await updateUser(ctx.db, user.id, { queue });

    // Return to settings
    const { showMainMenu } = await import("../start.js");
    await showMainMenu(ctx, user.id);
  });
}
