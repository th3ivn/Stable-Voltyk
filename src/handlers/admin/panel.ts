import type { Bot } from "grammy";
import type { BotContext } from "../../bot.js";
import { isAdmin } from "../../config.js";
import { getUserStats } from "../../db/queries/admin.js";
import {
  adminMenuKeyboard,
  adminAnalyticsKeyboard,
  adminUsersKeyboard,
  adminBackKeyboard,
} from "../../keyboards/inline.js";
import {
  adminPanelMessage,
  adminAnalyticsMessage,
  adminUsersStatsMessage,
} from "../../formatters/messages.js";

export function registerAdminPanelHandlers(bot: Bot<BotContext>): void {
  // Admin panel entry
  bot.callbackQuery("settings_admin", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    await ctx.editMessageText(adminPanelMessage(), {
      parse_mode: "HTML",
      reply_markup: adminMenuKeyboard(),
    });
  });

  // Analytics
  bot.callbackQuery("admin_analytics", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    const stats = await getUserStats(ctx.db);
    await ctx.editMessageText(
      adminAnalyticsMessage({
        totalUsers: stats.totalUsers,
        activeUsers: stats.activeUsers,
        usersWithIp: stats.usersWithIp,
        usersWithChannel: stats.usersWithChannel,
      }),
      { parse_mode: "HTML", reply_markup: adminAnalyticsKeyboard() },
    );
  });

  // Analytics week/month (placeholder — full implementation in Step 16)
  bot.callbackQuery("admin_analytics_week", async (ctx) => {
    await ctx.answerCallbackQuery("📈 Аналітика за тиждень буде доступна пізніше.");
  });

  bot.callbackQuery("admin_analytics_month", async (ctx) => {
    await ctx.answerCallbackQuery("📊 Аналітика за місяць буде доступна пізніше.");
  });

  // Users
  bot.callbackQuery("admin_users", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    const stats = await getUserStats(ctx.db);
    await ctx.editMessageText(
      adminUsersStatsMessage({
        totalUsers: stats.totalUsers,
        activeUsers: stats.activeUsers,
        blockedUsers: stats.blockedUsers,
        regionBreakdown: stats.regionBreakdown,
      }),
      { parse_mode: "HTML", reply_markup: adminUsersKeyboard() },
    );
  });

  bot.callbackQuery("admin_users_stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!isAdmin(ctx.from.id)) return;

    const stats = await getUserStats(ctx.db);
    await ctx.editMessageText(
      adminUsersStatsMessage({
        totalUsers: stats.totalUsers,
        activeUsers: stats.activeUsers,
        blockedUsers: stats.blockedUsers,
        regionBreakdown: stats.regionBreakdown,
      }),
      { parse_mode: "HTML", reply_markup: adminBackKeyboard() },
    );
  });
}
