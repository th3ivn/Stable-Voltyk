import type { Bot } from "grammy";
import type { BotContext } from "../bot.js";
import {
  findUserByTelegramId,
  createPendingChannel,
  findPendingChannelByChannelId,
} from "../db/queries/users.js";
import { pendingChannelKeyboard } from "../keyboards/inline.js";
import { pendingChannelMessage } from "../formatters/messages.js";

export function registerChatMemberHandlers(bot: Bot<BotContext>): void {
  // Detect when bot is added/removed as channel admin
  bot.on("my_chat_member", async (ctx) => {
    const update = ctx.myChatMember;
    if (update.chat.type !== "channel") return;

    const newStatus = update.new_chat_member.status;
    const oldStatus = update.old_chat_member.status;

    // Bot was added as admin to a channel
    if (
      (newStatus === "administrator" || newStatus === "creator") &&
      oldStatus !== "administrator" &&
      oldStatus !== "creator"
    ) {
      const fromId = update.from.id.toString();
      const user = await findUserByTelegramId(ctx.db, fromId);
      if (user === null) return;

      const channelId = update.chat.id.toString();
      const channelTitle = update.chat.title ?? "Без назви";

      // Check if already pending
      const existing = await findPendingChannelByChannelId(ctx.db, user.id, channelId);
      if (existing !== null) return;

      // Create pending channel entry
      const pending = await createPendingChannel(ctx.db, user.id, channelId, channelTitle);
      if (pending === null) return;

      // Notify user in their private chat
      try {
        await ctx.api.sendMessage(
          update.from.id,
          pendingChannelMessage(channelTitle),
          {
            parse_mode: "HTML",
            reply_markup: pendingChannelKeyboard(pending.id),
          },
        );
      } catch (err) {
        ctx.log?.warn({ error: err, userId: fromId }, "Failed to notify user about pending channel");
      }
    }

    // Bot was removed from channel
    if (
      (newStatus === "left" || newStatus === "kicked") &&
      (oldStatus === "administrator" || oldStatus === "creator")
    ) {
      // Could auto-disconnect, but for now just log
      ctx.log?.info(
        { channelId: update.chat.id, channelTitle: update.chat.title },
        "Bot removed from channel",
      );
    }
  });
}
