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

    await showChannelNotifSettings(ctx, data);
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

type UserWithRelations = NonNullable<Awaited<ReturnType<typeof findUserWithRelations>>>;

async function showBotNotifSettings(
  ctx: BotContext,
  data: UserWithRelations,
): Promise<void> {
  const ns = data.notificationSettings;
  const hasIp = data.user.routerIp != null && data.user.routerIp.length > 0;
  const fact = (ns?.notifyFactOff ?? false) || (ns?.notifyFactOn ?? false);

  const text = buildNotificationSettingsMessage({
    scheduleChanges: ns?.notifyScheduleChanges ?? true,
    remind1h: ns?.remind1h ?? false,
    remind30m: ns?.remind30m ?? false,
    remind15m: ns?.remind15m ?? true,
    fact,
    hasIp,
  });

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: notificationSettingsKeyboard(
      {
        scheduleChanges: ns?.notifyScheduleChanges ?? true,
        remind15m: ns?.remind15m ?? true,
        remind30m: ns?.remind30m ?? false,
        remind1h: ns?.remind1h ?? false,
        fact,
      },
      "notif_bot",
      hasIp,
    ),
  });
}

async function showChannelNotifSettings(
  ctx: BotContext,
  data: UserWithRelations,
): Promise<void> {
  const cc = data.channelConfig;
  const hasIp = data.user.routerIp != null && data.user.routerIp.length > 0;
  const fact = (cc?.chNotifyFactOff ?? false) || (cc?.chNotifyFactOn ?? false);

  const text = buildNotificationSettingsMessage({
    scheduleChanges: cc?.chNotifySchedule ?? true,
    remind1h: cc?.chRemind1h ?? false,
    remind30m: cc?.chRemind30m ?? false,
    remind15m: cc?.chRemind15m ?? true,
    fact,
    hasIp,
  });

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: notificationSettingsKeyboard(
      {
        scheduleChanges: cc?.chNotifySchedule ?? true,
        remind15m: cc?.chRemind15m ?? true,
        remind30m: cc?.chRemind30m ?? false,
        remind1h: cc?.chRemind1h ?? false,
        fact,
      },
      "notif_ch",
      hasIp,
    ),
  });
}

function registerNotifToggles(bot: Bot<BotContext>, prefix: string, target: "bot" | "channel"): void {
  const toggles: Record<string, string | string[]> = {
    [`${prefix}_toggle_schedule`]: target === "bot" ? "notifyScheduleChanges" : "chNotifySchedule",
    [`${prefix}_time_15`]: target === "bot" ? "remind15m" : "chRemind15m",
    [`${prefix}_time_30`]: target === "bot" ? "remind30m" : "chRemind30m",
    [`${prefix}_time_60`]: target === "bot" ? "remind1h" : "chRemind1h",
    // Single "fact" toggle updates both factOff and factOn together
    [`${prefix}_toggle_fact`]: target === "bot"
      ? ["notifyFactOff", "notifyFactOn"]
      : ["chNotifyFactOff", "chNotifyFactOn"],
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
        if (Array.isArray(field)) {
          // Toggle both factOff and factOn together
          const currentValue = (ns as Record<string, unknown>)?.[field[0] ?? ""] as boolean | undefined ?? false;
          const update: Record<string, boolean> = {};
          for (const f of field) {
            update[f] = !currentValue;
          }
          await updateNotificationSettings(ctx.db, data.user.id, update);
        } else {
          const currentValue = (ns as Record<string, unknown>)?.[field] as boolean | undefined ?? false;
          await updateNotificationSettings(ctx.db, data.user.id, { [field]: !currentValue });
        }
      } else {
        const { updateChannelConfig } = await import("../../db/queries/users.js");
        const cc = data.channelConfig;
        if (Array.isArray(field)) {
          const currentValue = (cc as Record<string, unknown>)?.[field[0] ?? ""] as boolean | undefined ?? false;
          const update: Record<string, boolean> = {};
          for (const f of field) {
            update[f] = !currentValue;
          }
          await updateChannelConfig(ctx.db, data.user.id, update);
        } else {
          const currentValue = (cc as Record<string, unknown>)?.[field] as boolean | undefined ?? false;
          await updateChannelConfig(ctx.db, data.user.id, { [field]: !currentValue });
        }
      }

      // Refresh the view
      const refreshed = await findUserWithRelations(ctx.db, telegramId);
      if (refreshed === null) return;

      if (target === "bot") {
        await showBotNotifSettings(ctx, refreshed);
      } else {
        await showChannelNotifSettings(ctx, refreshed);
      }
    });
  }
}
