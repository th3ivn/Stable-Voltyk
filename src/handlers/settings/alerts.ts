import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import {
  findUserWithRelations,
  updateNotificationSettings,
} from "../../db/queries/users.js";
import {
  alertsTargetKeyboard,
  notificationSettingsKeyboard,
} from "../../keyboards/inline.js";
import { buildNotificationSettingsMessage } from "../../formatters/messages.js";

export function registerAlertsHandlers(bot: Bot<BotContext>): void {
  // Settings → Alerts
  bot.callbackQuery("settings_alerts", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const hasChannel =
      data.channelConfig?.channelId != null && data.channelConfig.channelId.length > 0;

    if (hasChannel) {
      // Show target selection
      const text = "🔔 Керування сповіщеннями\n\nОберіть, що хочете налаштувати:";
      await ctx.editMessageText(text, { reply_markup: alertsTargetKeyboard() });
    } else {
      // Show bot notification settings directly
      await showBotNotifSettings(ctx, data);
    }
  });

  // Select bot notifications
  bot.callbackQuery("notif_select_bot", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    await showBotNotifSettings(ctx, data);
  });

  // Select channel notifications
  bot.callbackQuery("notif_select_channel", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const cc = data.channelConfig;
    const text = buildNotificationSettingsMessage({
      scheduleChanges: cc?.chNotifySchedule ?? true,
      remind1h: cc?.chRemind1h ?? false,
      remind30m: cc?.chRemind30m ?? false,
      remind15m: cc?.chRemind15m ?? true,
      factOff: cc?.chNotifyFactOff ?? true,
      factOn: cc?.chNotifyFactOn ?? true,
      remindOff: cc?.chNotifyRemindOff ?? true,
      remindOn: cc?.chNotifyRemindOn ?? true,
    });

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: notificationSettingsKeyboard(
        {
          scheduleChanges: cc?.chNotifySchedule ?? true,
          remindOff: cc?.chNotifyRemindOff ?? true,
          remindOn: cc?.chNotifyRemindOn ?? true,
          factOff: cc?.chNotifyFactOff ?? true,
          factOn: cc?.chNotifyFactOn ?? true,
          remind15m: cc?.chRemind15m ?? true,
          remind30m: cc?.chRemind30m ?? false,
          remind1h: cc?.chRemind1h ?? false,
        },
        "notif_ch",
      ),
    });
  });

  // Bot notification toggles
  registerNotifToggles(bot, "notif_bot", "bot");

  // Channel notification toggles
  registerNotifToggles(bot, "notif_ch", "channel");

  // Back buttons
  bot.callbackQuery("notif_bot_back", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const hasChannel =
      data.channelConfig?.channelId != null && data.channelConfig.channelId.length > 0;

    if (hasChannel) {
      const text = "🔔 Керування сповіщеннями\n\nОберіть, що хочете налаштувати:";
      await ctx.editMessageText(text, { reply_markup: alertsTargetKeyboard() });
    } else {
      const { showMainMenu } = await import("../start.js");
      await showMainMenu(ctx, data.user.id);
    }
  });

  bot.callbackQuery("notif_ch_back", async (ctx) => {
    await ctx.answerCallbackQuery();
    const text = "🔔 Керування сповіщеннями\n\nОберіть, що хочете налаштувати:";
    await ctx.editMessageText(text, { reply_markup: alertsTargetKeyboard() });
  });
}

async function showBotNotifSettings(
  ctx: BotContext,
  data: NonNullable<Awaited<ReturnType<typeof findUserWithRelations>>>,
): Promise<void> {
  const ns = data.notificationSettings;
  const text = buildNotificationSettingsMessage({
    scheduleChanges: ns?.notifyScheduleChanges ?? true,
    remind1h: ns?.remind1h ?? false,
    remind30m: ns?.remind30m ?? false,
    remind15m: ns?.remind15m ?? true,
    factOff: ns?.notifyFactOff ?? true,
    factOn: ns?.notifyFactOn ?? true,
    remindOff: ns?.notifyRemindOff ?? true,
    remindOn: ns?.notifyRemindOn ?? true,
  });

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: notificationSettingsKeyboard(
      {
        scheduleChanges: ns?.notifyScheduleChanges ?? true,
        remindOff: ns?.notifyRemindOff ?? true,
        remindOn: ns?.notifyRemindOn ?? true,
        factOff: ns?.notifyFactOff ?? true,
        factOn: ns?.notifyFactOn ?? true,
        remind15m: ns?.remind15m ?? true,
        remind30m: ns?.remind30m ?? false,
        remind1h: ns?.remind1h ?? false,
      },
      "notif_bot",
    ),
  });
}

function registerNotifToggles(bot: Bot<BotContext>, prefix: string, target: "bot" | "channel"): void {
  const toggles: Record<string, string> = {
    [`${prefix}_toggle_schedule`]: target === "bot" ? "notifyScheduleChanges" : "chNotifySchedule",
    [`${prefix}_toggle_remind_off`]: target === "bot" ? "notifyRemindOff" : "chNotifyRemindOff",
    [`${prefix}_toggle_remind_on`]: target === "bot" ? "notifyRemindOn" : "chNotifyRemindOn",
    [`${prefix}_toggle_fact_off`]: target === "bot" ? "notifyFactOff" : "chNotifyFactOff",
    [`${prefix}_toggle_fact_on`]: target === "bot" ? "notifyFactOn" : "chNotifyFactOn",
    [`${prefix}_time_15`]: target === "bot" ? "remind15m" : "chRemind15m",
    [`${prefix}_time_30`]: target === "bot" ? "remind30m" : "chRemind30m",
    [`${prefix}_time_60`]: target === "bot" ? "remind1h" : "chRemind1h",
  };

  for (const [callbackData, field] of Object.entries(toggles)) {
    bot.callbackQuery(callbackData, async (ctx) => {
      await ctx.answerCallbackQuery();
      const telegramId = ctx.from?.id.toString();
      if (telegramId === undefined) return;

      const data = await findUserWithRelations(ctx.db, telegramId);
      if (data === null) return;

      if (target === "bot") {
        const ns = data.notificationSettings;
        const currentValue = (ns as Record<string, unknown>)?.[field] as boolean | undefined ?? false;
        await updateNotificationSettings(ctx.db, data.user.id, { [field]: !currentValue });
      } else {
        const { updateChannelConfig } = await import("../../db/queries/users.js");
        const cc = data.channelConfig;
        const currentValue = (cc as Record<string, unknown>)?.[field] as boolean | undefined ?? false;
        await updateChannelConfig(ctx.db, data.user.id, { [field]: !currentValue });
      }

      // Refresh the view
      const refreshed = await findUserWithRelations(ctx.db, telegramId);
      if (refreshed === null) return;

      if (target === "bot") {
        await showBotNotifSettings(ctx, refreshed);
      } else {
        // Trigger notif_select_channel logic
        const cc = refreshed.channelConfig;
        const text = buildNotificationSettingsMessage({
          scheduleChanges: cc?.chNotifySchedule ?? true,
          remind1h: cc?.chRemind1h ?? false,
          remind30m: cc?.chRemind30m ?? false,
          remind15m: cc?.chRemind15m ?? true,
          factOff: cc?.chNotifyFactOff ?? true,
          factOn: cc?.chNotifyFactOn ?? true,
          remindOff: cc?.chNotifyRemindOff ?? true,
          remindOn: cc?.chNotifyRemindOn ?? true,
        });

        await ctx.editMessageText(text, {
          parse_mode: "HTML",
          reply_markup: notificationSettingsKeyboard(
            {
              scheduleChanges: cc?.chNotifySchedule ?? true,
              remindOff: cc?.chNotifyRemindOff ?? true,
              remindOn: cc?.chNotifyRemindOn ?? true,
              factOff: cc?.chNotifyFactOff ?? true,
              factOn: cc?.chNotifyFactOn ?? true,
              remind15m: cc?.chRemind15m ?? true,
              remind30m: cc?.chRemind30m ?? false,
              remind1h: cc?.chRemind1h ?? false,
            },
            "notif_ch",
          ),
        });
      }
    });
  }
}
