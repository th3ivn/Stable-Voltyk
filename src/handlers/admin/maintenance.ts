import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { isAdmin } from "../../config.js";
import { getSettingBool, setSetting } from "../../db/queries/settings.js";
import { adminMaintenanceKeyboard } from "../../keyboards/inline.js";
import { adminMaintenanceMessage } from "../../formatters/messages.js";

export function registerAdminMaintenanceHandlers(bot: Bot<BotContext>): void {
  // Show maintenance status
  bot.callbackQuery("admin_maintenance", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    const isActive = await getSettingBool(ctx.db, "maintenance_mode", false);
    await ctx.editMessageText(adminMaintenanceMessage(isActive), {
      parse_mode: "HTML",
      reply_markup: adminMaintenanceKeyboard(isActive),
    });
  });

  // Turn on maintenance
  bot.callbackQuery("admin_maintenance_on", async (ctx) => {
    await ctx.answerCallbackQuery("🔧 Тех. роботи увімкнено");
    if (!isAdmin(ctx.from.id)) return;

    await setSetting(ctx.db, "maintenance_mode", "true");

    await ctx.editMessageText(adminMaintenanceMessage(true), {
      parse_mode: "HTML",
      reply_markup: adminMaintenanceKeyboard(true),
    });
  });

  // Turn off maintenance
  bot.callbackQuery("admin_maintenance_off", async (ctx) => {
    await ctx.answerCallbackQuery("✅ Тех. роботи вимкнено");
    if (!isAdmin(ctx.from.id)) return;

    await setSetting(ctx.db, "maintenance_mode", "false");

    await ctx.editMessageText(adminMaintenanceMessage(false), {
      parse_mode: "HTML",
      reply_markup: adminMaintenanceKeyboard(false),
    });
  });
}
