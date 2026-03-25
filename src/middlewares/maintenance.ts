import type { NextFunction } from "grammy";
import type { BotContext } from "../bot.js";
import { getSettingBool } from "../db/queries/settings.js";

let maintenanceMode = false;
let maintenanceMessage = "🔧 Бот на технічному обслуговуванні. Спробуйте пізніше.";

export function setMaintenance(enabled: boolean, message?: string): void {
  maintenanceMode = enabled;
  if (message !== undefined) {
    maintenanceMessage = message;
  }
}

export function isMaintenanceMode(): boolean {
  return maintenanceMode;
}

export async function maintenanceMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  if (maintenanceMode) {
    // Allow admins through
    // Admin check will be added later when config is available in context
    if (ctx.message !== undefined || ctx.callbackQuery !== undefined) {
      await ctx.reply(maintenanceMessage);
    }
    return;
  }
  await next();
}

export async function loadMaintenanceState(db: Parameters<typeof getSettingBool>[0]): Promise<void> {
  maintenanceMode = await getSettingBool(db, "maintenance_mode", false);
}
