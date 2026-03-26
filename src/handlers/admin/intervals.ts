import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { isAdmin } from "../../config.js";
import { setSetting, getSettingBool, getSettingInt } from "../../db/queries/settings.js";
import { adminSettingsKeyboard } from "../../keyboards/inline.js";
import { adminSettingsMessage } from "../../formatters/messages.js";
import { config } from "../../config.js";

async function getAdminSettings(db: BotContext["db"]) {
  const registrationOpen = await getSettingBool(db, "registration_open", true);
  const scheduleInterval = await getSettingInt(db, "schedule_check_interval_s", config.SCHEDULE_CHECK_INTERVAL_S);
  const powerInterval = await getSettingInt(db, "power_check_interval_s", config.POWER_CHECK_INTERVAL_S);
  const debounceMinutes = await getSettingInt(db, "power_debounce_minutes", config.POWER_DEBOUNCE_MINUTES);
  return { registrationOpen, scheduleInterval, powerInterval, debounceMinutes };
}

export function registerAdminIntervalsHandlers(bot: Bot<BotContext>): void {
  // Admin settings overview
  bot.callbackQuery("admin_settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    const settings = await getAdminSettings(ctx.db);
    await ctx.editMessageText(adminSettingsMessage(settings), {
      parse_mode: "HTML",
      reply_markup: adminSettingsKeyboard(settings),
    });
  });

  // Toggle registration
  bot.callbackQuery("admin_toggle_registration", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    const current = await getSettingBool(ctx.db, "registration_open", true);
    await setSetting(ctx.db, "registration_open", current ? "false" : "true");

    const settings = await getAdminSettings(ctx.db);
    await ctx.editMessageText(adminSettingsMessage(settings), {
      parse_mode: "HTML",
      reply_markup: adminSettingsKeyboard(settings),
    });
  });

  // Set schedule interval
  bot.callbackQuery("admin_set_schedule_interval", async (ctx) => {
    const current = await getSettingInt(ctx.db, "schedule_check_interval_s", config.SCHEDULE_CHECK_INTERVAL_S);
    // Cycle through common values: 30, 60, 120, 300
    const values = [30, 60, 120, 300];
    const idx = values.indexOf(current);
    const next = values[(idx + 1) % values.length] ?? 60;
    await setSetting(ctx.db, "schedule_check_interval_s", next.toString());

    await ctx.answerCallbackQuery(`⏱ Інтервал графіків: ${next}с`);

    const settings = await getAdminSettings(ctx.db);
    await ctx.editMessageText(adminSettingsMessage(settings), {
      parse_mode: "HTML",
      reply_markup: adminSettingsKeyboard(settings),
    });
  });

  // Set power interval
  bot.callbackQuery("admin_set_power_interval", async (ctx) => {
    const current = await getSettingInt(ctx.db, "power_check_interval_s", config.POWER_CHECK_INTERVAL_S);
    const values = [0, 30, 60, 120, 300];
    const idx = values.indexOf(current);
    const next = values[(idx + 1) % values.length] ?? 60;
    await setSetting(ctx.db, "power_check_interval_s", next.toString());

    await ctx.answerCallbackQuery(`📡 Інтервал IP: ${next}с`);

    const settings = await getAdminSettings(ctx.db);
    await ctx.editMessageText(adminSettingsMessage(settings), {
      parse_mode: "HTML",
      reply_markup: adminSettingsKeyboard(settings),
    });
  });

  // Set debounce
  bot.callbackQuery("admin_set_debounce", async (ctx) => {
    const current = await getSettingInt(ctx.db, "power_debounce_minutes", config.POWER_DEBOUNCE_MINUTES);
    const values = [1, 3, 5, 10, 15];
    const idx = values.indexOf(current);
    const next = values[(idx + 1) % values.length] ?? 5;
    await setSetting(ctx.db, "power_debounce_minutes", next.toString());

    await ctx.answerCallbackQuery(`⏳ Debounce: ${next}хв`);

    const settings = await getAdminSettings(ctx.db);
    await ctx.editMessageText(adminSettingsMessage(settings), {
      parse_mode: "HTML",
      reply_markup: adminSettingsKeyboard(settings),
    });
  });
}
