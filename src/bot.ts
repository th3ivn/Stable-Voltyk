import { Bot, Context, SessionFlavor, session, GrammyError, HttpError } from "grammy";
import type { Database } from "./db/client.js";
import { logger } from "./utils/logger.js";
import type { Logger } from "./utils/logger.js";

// ============================================================
// Session data (wizard state + temp data)
// ============================================================
export interface SessionData {
  // Wizard state
  wizardStep?: "region" | "queue" | "notify_target" | "notif_settings" | "done";
  wizardRegion?: string;
  wizardQueue?: string;
  wizardNotifSchedule?: boolean;
  wizardNotifRemind15m?: boolean;
  wizardNotifRemind30m?: boolean;
  wizardNotifRemind1h?: boolean;
  wizardNotifFact?: boolean;

  // IP input state
  awaitingIpInput?: boolean;

  // Channel conversation state
  awaitingChannelTitle?: boolean;
  awaitingChannelDesc?: boolean;
}

// ============================================================
// Custom context
// ============================================================
export interface BotContext extends Context, SessionFlavor<SessionData> {
  db: Database;
  requestId: string;
  log: Logger;
}

// ============================================================
// Create bot instance
// ============================================================
export function createBot(token: string, db: Database): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // Session middleware
  bot.use(
    session({
      initial: (): SessionData => ({}),
    }),
  );

  // Inject db + requestId + logger into context
  bot.use(async (ctx, next) => {
    ctx.db = db;
    ctx.requestId = crypto.randomUUID();
    ctx.log = logger.child({
      requestId: ctx.requestId,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
    }) as Logger;
    const start = Date.now();
    try {
      await next();
    } finally {
      const duration = Date.now() - start;
      if (duration > 1000) {
        ctx.log.warn({ durationMs: duration }, "Slow update processing");
      }
    }
  });

  // Global error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;

    if (e instanceof GrammyError) {
      // Ignore common non-critical errors
      if (
        e.description.includes("message is not modified") ||
        e.description.includes("query is too old")
      ) {
        return;
      }
      // Log blocked users as warn, not error
      if (e.description.includes("bot was blocked") || e.description.includes("chat not found")) {
        ctx.log?.warn({ error: e.description, method: e.method }, "User unavailable");
        return;
      }
      ctx.log?.error({ error: e.description, method: e.method }, "Telegram API error");
    } else if (e instanceof HttpError) {
      ctx.log?.error({ error: e.message }, "HTTP error");
    } else {
      logger.error({ error: e, userId: ctx.from?.id }, "Unhandled error");
    }

    // Try to notify user
    try {
      if (ctx.callbackQuery !== undefined) {
        void ctx.answerCallbackQuery("Щось пішло не так. Спробуйте ще раз.");
      }
    } catch {
      // ignore
    }
  });

  return bot;
}
