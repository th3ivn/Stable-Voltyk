import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { findUserWithRelations } from "../../db/queries/users.js";
import { channelTestKeyboard } from "../../keyboards/inline.js";
import { channelTestSentMessage } from "../../formatters/messages.js";

export function registerChannelTestHandlers(bot: Bot<BotContext>): void {
  bot.callbackQuery("channel_test", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const channelId = data.channelConfig?.channelId;
    if (channelId == null || channelId.length === 0) {
      await ctx.editMessageText("❌ Канал не підключено.", {
        reply_markup: channelTestKeyboard(),
      });
      return;
    }

    const channelTitle = data.channelConfig?.channelTitle ?? "Канал";

    try {
      await ctx.api.sendMessage(
        channelId,
        `🧪 Тестове повідомлення від бота Вольтик ⚡\n\nВсе працює коректно!`,
      );

      await ctx.editMessageText(channelTestSentMessage(channelTitle), {
        reply_markup: channelTestKeyboard(),
      });
    } catch (err) {
      ctx.log?.warn({ error: err, channelId }, "Failed to send test message to channel");
      await ctx.editMessageText(
        `❌ Не вдалося надіслати повідомлення в канал.\n\nПеревірте, чи бот є адміністратором каналу.`,
        { reply_markup: channelTestKeyboard() },
      );
    }
  });
}
