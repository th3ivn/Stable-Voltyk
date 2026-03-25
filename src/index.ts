import "dotenv/config";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { createBot } from "./bot.js";
import { createDbConnection } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { registerStartHandlers } from "./handlers/start.js";
import { registerMenuHandlers } from "./handlers/menu.js";
import { webhookCallback } from "grammy";
import express from "express";

async function main(): Promise<void> {
  logger.info("Starting Voltyk bot...");

  // 1. Database
  logger.info("Connecting to database...");
  const db = await createDbConnection(config.DATABASE_URL);

  // 2. Run migrations
  await runMigrations(config.DATABASE_URL);

  // 3. Create bot
  const bot = createBot(config.BOT_TOKEN, db);

  // 4. Register handlers
  registerStartHandlers(bot);
  registerMenuHandlers(bot);

  // 5. Initialize bot (required for webhook mode)
  logger.info("Initializing bot...");
  await bot.init();
  logger.info({ botUsername: bot.botInfo.username }, "Bot initialized");

  // 6. Start bot
  if (config.USE_WEBHOOK && config.WEBHOOK_URL.length > 0) {
    // Webhook mode (production)
    const app = express();

    // Parse JSON body (required for grammY webhook)
    app.use(express.json());

    // Debug: log all incoming requests
    app.use((req, _res, next) => {
      logger.info({ method: req.method, path: req.path }, "Incoming HTTP request");
      next();
    });

    // Webhook endpoint (POST only)
    const webhookHandler = webhookCallback(bot, "express", {
      secretToken: config.WEBHOOK_SECRET.length > 0 ? config.WEBHOOK_SECRET : undefined,
    });
    app.post(config.WEBHOOK_PATH, webhookHandler);

    // Health check
    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        bot: bot.botInfo.username,
      });
    });

    // Set webhook
    const webhookUrl = `${config.WEBHOOK_URL}${config.WEBHOOK_PATH}`;
    logger.info({ webhookUrl }, "Setting webhook...");

    try {
      await bot.api.setWebhook(webhookUrl, {
        secret_token: config.WEBHOOK_SECRET.length > 0 ? config.WEBHOOK_SECRET : undefined,
        allowed_updates: ["message", "callback_query", "my_chat_member"],
      });
      logger.info("Webhook set successfully");

      // Verify webhook info
      const webhookInfo = await bot.api.getWebhookInfo();
      logger.info({
        url: webhookInfo.url,
        hasCustomCert: webhookInfo.has_custom_certificate,
        pendingCount: webhookInfo.pending_update_count,
        lastError: webhookInfo.last_error_message,
        lastErrorDate: webhookInfo.last_error_date,
      }, "Webhook info");
    } catch (err) {
      logger.error({ error: err }, "Failed to set webhook");
      throw err;
    }

    // Start HTTP server
    app.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`);
    });
  } else {
    // Long polling mode (development)
    logger.info("Starting in long polling mode...");
    await bot.api.deleteWebhook();
    void bot.start({
      onStart: () => logger.info("Bot started (long polling)"),
    });
  }

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down...`);
    await bot.stop();
    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ error: err }, "Fatal startup error");
  process.exit(1);
});
