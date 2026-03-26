import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { findUserByTelegramId, deleteUser } from "../../db/queries/users.js";
import { deletePowerState } from "../../db/queries/power.js";
import { deleteDataStep1Keyboard, deleteDataStep2Keyboard } from "../../keyboards/inline.js";
import {
  deleteDataStep1Message,
  deleteDataStep2Message,
  deleteDataDoneMessage,
} from "../../formatters/messages.js";

export function registerDataHandlers(bot: Bot<BotContext>): void {
  // Delete data — step 1
  bot.callbackQuery("settings_delete_data", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(deleteDataStep1Message(), {
      reply_markup: deleteDataStep1Keyboard(),
    });
  });

  // Delete data — step 2 confirmation
  bot.callbackQuery("delete_data_confirm", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(deleteDataStep2Message(), {
      reply_markup: deleteDataStep2Keyboard(),
    });
  });

  // Delete data — execute
  bot.callbackQuery("delete_data_execute", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    // Delete power state
    await deletePowerState(ctx.db, telegramId);

    // Delete user (cascades to all related tables)
    await deleteUser(ctx.db, user.id);

    // Clear session
    ctx.session = {};

    await ctx.editMessageText(deleteDataDoneMessage());
  });
}
