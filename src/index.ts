import "dotenv/config";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { createBot } from "./bot.js";
import { createDbConnection } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { registerStartHandlers } from "./handlers/start.js";
import { registerMenuHandlers } from "./handlers/menu.js";
import { registerRegionHandlers } from "./handlers/settings/region.js";
import { registerAlertsHandlers } from "./handlers/settings/alerts.js";
import { registerIpHandlers } from "./handlers/settings/ip.js";
import { registerChannelSettingsHandlers } from "./handlers/settings/channel.js";
import { registerCleanupHandlers } from "./handlers/settings/cleanup.js";
import { registerDataHandlers } from "./handlers/settings/data.js";
import { webhookCallback } from "grammy";
import express from "express";

async function main(): Promise<void> {
  logger.info("Starting Voltyk bot...");

  // 1. Database
  const db = await createDbConnection(config.DATABASE_URL);

  // 2. Run migrations
  await runMigrations(config.DATABASE_URL);

  // 3. Create bot
  const bot = createBot(config.BOT_TOKEN, db);

  // 4. Register handlers
  registerStartHandlers(bot);
  registerMenuHandlers(bot);
  registerRegionHandlers(bot);
  registerAlertsHandlers(bot);
  registerIpHandlers(bot);
  registerChannelSettingsHandlers(bot);
  registerCleanupHandlers(bot);
  registerDataHandlers(bot);

  // 5. Initialize bot (required for webhook mode)
  await bot.init();
  logger.info({ botUsername: bot.botInfo.username }, "Bot initialized");

  // 6. Start bot
  if (config.USE_WEBHOOK && config.WEBHOOK_URL.length > 0) {
    // Webhook mode (production)
    const app = express();
    app.use(express.json());

    // Webhook endpoint
    app.post(
      config.WEBHOOK_PATH,
      webhookCallback(bot, "express", {
        secretToken: config.WEBHOOK_SECRET.length > 0 ? config.WEBHOOK_SECRET : undefined,
      }),
    );

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
    try {
      await bot.api.setWebhook(webhookUrl, {
        secret_token: config.WEBHOOK_SECRET.length > 0 ? config.WEBHOOK_SECRET : undefined,
        allowed_updates: ["message", "callback_query", "my_chat_member"],
      });
      logger.info({ webhookUrl }, "Webhook set successfully");
    } catch (err) {
      logger.error({ error: err }, "Failed to set webhook");
      throw err;
    }

    // Start HTTP server
    app.listen(config.PORT, () => {
      logger.info({ port: config.PORT }, "Server running");
    });
  } else {
    // Long polling mode (development)
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
