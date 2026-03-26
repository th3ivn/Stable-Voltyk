import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { findUserWithRelations, updateChannelConfig } from "../../db/queries/users.js";
import { channelNotificationsKeyboard } from "../../keyboards/inline.js";
import { channelNotificationsMessage } from "../../formatters/messages.js";

export function registerChannelNotificationHandlers(bot: Bot<BotContext>): void {
  // Show channel notifications
  bot.callbackQuery("channel_notifications", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    await showNotifications(ctx, data);
  });

  // Toggle handlers
  const toggles: Record<string, keyof ChannelNotifFields> = {
    ch_toggle_schedule: "chNotifySchedule",
    ch_toggle_remind_off: "chNotifyRemindOff",
    ch_toggle_remind_on: "chNotifyRemindOn",
    ch_toggle_fact_off: "chNotifyFactOff",
    ch_toggle_fact_on: "chNotifyFactOn",
    ch_time_15: "chRemind15m",
    ch_time_30: "chRemind30m",
    ch_time_60: "chRemind1h",
  };

  for (const [callbackData, field] of Object.entries(toggles)) {
    bot.callbackQuery(callbackData, async (ctx) => {
      await ctx.answerCallbackQuery();
      const telegramId = ctx.from?.id.toString();
      if (telegramId === undefined) return;

      const data = await findUserWithRelations(ctx.db, telegramId);
      if (data === null) return;

      const current = data.channelConfig?.[field] ?? false;
      await updateChannelConfig(ctx.db, data.user.id, { [field]: !current });

      const refreshed = await findUserWithRelations(ctx.db, telegramId);
      if (refreshed === null) return;
      await showNotifications(ctx, refreshed);
    });
  }
}

type ChannelNotifFields = {
  chNotifySchedule: boolean;
  chNotifyRemindOff: boolean;
  chNotifyRemindOn: boolean;
  chNotifyFactOff: boolean;
  chNotifyFactOn: boolean;
  chRemind15m: boolean;
  chRemind30m: boolean;
  chRemind1h: boolean;
};

async function showNotifications(
  ctx: BotContext,
  data: NonNullable<Awaited<ReturnType<typeof findUserWithRelations>>>,
): Promise<void> {
  const cc = data.channelConfig;
  const settings = {
    chNotifySchedule: cc?.chNotifySchedule ?? true,
    chNotifyRemindOff: cc?.chNotifyRemindOff ?? true,
    chNotifyRemindOn: cc?.chNotifyRemindOn ?? true,
    chNotifyFactOff: cc?.chNotifyFactOff ?? true,
    chNotifyFactOn: cc?.chNotifyFactOn ?? true,
    chRemind15m: cc?.chRemind15m ?? true,
    chRemind30m: cc?.chRemind30m ?? false,
    chRemind1h: cc?.chRemind1h ?? false,
  };

  await ctx.editMessageText(channelNotificationsMessage(settings), {
    parse_mode: "HTML",
    reply_markup: channelNotificationsKeyboard(settings),
  });
}
