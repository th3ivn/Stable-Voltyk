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
      updateType: ctx.update ? Object.keys(ctx.update).filter((k) => k !== "update_id")[0] : "unknown",
    }) as Logger;
    ctx.log.info("Incoming update");
    const start = Date.now();
    try {
      await next();
    } finally {
      ctx.log.info({ durationMs: Date.now() - start }, "Update processed");
    }
  });

  // Global error handler
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;

    if (e instanceof GrammyError) {
      // Ignore "message is not modified" errors
      if (e.description.includes("message is not modified")) {
        return;
      }
      logger.error({ error: e.description, method: e.method }, "Grammy API error");
    } else if (e instanceof HttpError) {
      logger.error({ error: e.message }, "HTTP error");
    } else {
      logger.error({ error: e }, "Unhandled error");
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
