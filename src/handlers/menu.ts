import type { Bot } from "grammy";
import type { BotContext } from "../bot.js";
import { showMainMenu } from "./start.js";
import { findUserByTelegramId } from "../db/queries/users.js";

export function registerMenuHandlers(bot: Bot<BotContext>): void {
  // Back to main menu
  bot.callbackQuery("back_to_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    await showMainMenu(ctx, user.id);
  });
}
