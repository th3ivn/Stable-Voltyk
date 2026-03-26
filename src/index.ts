import "dotenv/config";
import { config } from "./config.js";
import { logger } from "./utils/logger.js";
import { createBot } from "./bot.js";
import { createDbConnection, checkDatabaseHealth } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";

// Handlers
import { registerStartHandlers } from "./handlers/start.js";
import { registerMenuHandlers } from "./handlers/menu.js";
import { registerRegionHandlers } from "./handlers/settings/region.js";
import { registerAlertsHandlers } from "./handlers/settings/alerts.js";
import { registerIpHandlers } from "./handlers/settings/ip.js";
import { registerChannelSettingsHandlers } from "./handlers/settings/channel.js";
import { registerCleanupHandlers } from "./handlers/settings/cleanup.js";
import { registerDataHandlers } from "./handlers/settings/data.js";
import { registerChatMemberHandlers } from "./handlers/chat-member.js";
import { registerAdminPanelHandlers } from "./handlers/admin/panel.js";
import { registerAdminBroadcastHandlers } from "./handlers/admin/broadcast.js";
import { registerAdminIntervalsHandlers } from "./handlers/admin/intervals.js";
import { registerAdminMaintenanceHandlers } from "./handlers/admin/maintenance.js";
import { registerAdminPauseHandlers } from "./handlers/admin/pause.js";
import { registerChannelConnectHandlers } from "./handlers/channel/connect.js";
import { registerChannelConversationHandlers } from "./handlers/channel/conversation.js";
import { registerChannelFormatHandlers } from "./handlers/channel/format.js";
import { registerChannelNotificationHandlers } from "./handlers/channel/notifications.js";
import { registerChannelTestHandlers } from "./handlers/channel/test.js";

// Services
import { initPowerMonitor, stopPowerMonitor, getPowerMonitorStatus } from "./services/power-monitor.js";
import { startScheduler, stopScheduler, getSchedulerStatus } from "./services/scheduler.js";
import { initRetryQueue, stopRetryQueue, getRetryQueueStatus } from "./services/retry-queue.js";
import { getCircuitBreakerState } from "./services/api.js";
import { getMetrics, setGauge } from "./services/metrics.js";
import { initAdminNotify, notifyAdmins } from "./services/admin-notify.js";

// Express + grammY webhook
import { webhookCallback } from "grammy";
import express from "express";

async function main(): Promise<void> {
  logger.info("Starting Voltyk bot...");

  // ============================================================
  // 1. Database connection (with retry)
  // ============================================================
  const db = await createDbConnection(config.DATABASE_URL);

  // ============================================================
  // 2. Auto-migrate database
  // ============================================================
  logger.info("Running database migrations...");
  await runMigrations(config.DATABASE_URL);
  logger.info("Migrations complete");

  // ============================================================
  // 3. Create bot instance
  // ============================================================
  const bot = createBot(config.BOT_TOKEN, db);

  // ============================================================
  // 4. Initialize admin notifications (before handlers, so services can use it)
  // ============================================================
  initAdminNotify(bot);

  // ============================================================
  // 5. Register all handlers
  // ============================================================
  registerStartHandlers(bot);
  registerMenuHandlers(bot);
  registerRegionHandlers(bot);
  registerAlertsHandlers(bot);
  registerIpHandlers(bot);
  registerChannelSettingsHandlers(bot);
  registerChannelConnectHandlers(bot);
  registerChannelConversationHandlers(bot);
  registerChannelFormatHandlers(bot);
  registerChannelNotificationHandlers(bot);
  registerChannelTestHandlers(bot);
  registerCleanupHandlers(bot);
  registerDataHandlers(bot);
  registerAdminPanelHandlers(bot);
  registerAdminBroadcastHandlers(bot);
  registerAdminIntervalsHandlers(bot);
  registerAdminMaintenanceHandlers(bot);
  registerAdminPauseHandlers(bot);
  registerChatMemberHandlers(bot);

  // ============================================================
  // 6. Startup self-test
  // ============================================================
  logger.info("Running startup self-test...");

  const dbHealth = await checkDatabaseHealth(db);
  if (!dbHealth.ok) {
    throw new Error("Startup check failed: Database");
  }
  setGauge("dbLatencyMs", dbHealth.latencyMs);
  logger.info({ latencyMs: dbHealth.latencyMs }, "Database: OK");

  await bot.init();
  logger.info({ botUsername: bot.botInfo.username }, "Bot Token: OK");

  // GitHub API check (non-blocking — may fail if rate limited)
  try {
    const ghUrl = config.DATA_URL_TEMPLATE.replace("{region}", "kyiv");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const ghResponse = await fetch(ghUrl, { method: "HEAD", signal: controller.signal });
    clearTimeout(timeout);
    logger.info({ status: ghResponse.status }, "GitHub API: OK");
  } catch {
    logger.warn("GitHub API: unreachable (non-critical)");
  }

  logger.info("All startup checks passed");

  // ============================================================
  // 7. Initialize services
  // ============================================================

  // Retry queue
  initRetryQueue(bot);

  // Power monitor (load state from DB)
  await initPowerMonitor(db, bot);

  // Scheduler (cron jobs)
  startScheduler(db, bot);

  // ============================================================
  // 8. Start bot (webhook or long polling)
  // ============================================================
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

    // Health check endpoint
    app.get("/health", async (_req, res) => {
      const dbCheck = await checkDatabaseHealth(db);
      setGauge("dbLatencyMs", dbCheck.latencyMs);
      const scheduler = getSchedulerStatus();
      const powerMonitor = getPowerMonitorStatus();
      const retryQueue = getRetryQueueStatus();
      const circuitBreaker = getCircuitBreakerState();

      const isHealthy = dbCheck.ok && scheduler.isRunning;

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? "ok" : "degraded",
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        bot: bot.botInfo.username,
        database: { ok: dbCheck.ok, latencyMs: dbCheck.latencyMs },
        scheduler: { running: scheduler.isRunning, jobs: scheduler.jobCount },
        powerMonitor: { running: powerMonitor.isRunning, users: powerMonitor.trackedUsers },
        retryQueue: { running: retryQueue.isRunning, size: retryQueue.queueSize },
        circuitBreaker,
      });
    });

    // Metrics endpoint (full metrics with counters, gauges, histograms)
    app.get("/metrics", (_req, res) => {
      const metrics = getMetrics();

      // Enrich with service-specific info
      res.json({
        ...metrics,
        services: {
          scheduler: getSchedulerStatus(),
          powerMonitor: getPowerMonitorStatus(),
          retryQueue: getRetryQueueStatus(),
          circuitBreaker: getCircuitBreakerState(),
        },
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

  // ============================================================
  // 9. Notify admins
  // ============================================================
  await notifyAdmins("🟢 Bot started", "info");

  // ============================================================
  // 10. Graceful shutdown
  // ============================================================
  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, starting graceful shutdown...`);

    // 1. Stop accepting new updates
    try {
      await bot.stop();
    } catch {
      // May already be stopped
    }

    // 2. Stop scheduler (wait for current jobs)
    stopScheduler();

    // 3. Stop power monitor (persist states)
    await stopPowerMonitor();

    // 4. Flush retry queue
    await stopRetryQueue();

    // 5. Notify admins (best effort)
    try {
      await notifyAdmins("🔴 Bot stopped", "info");
    } catch {
      // Ignore — bot may be stopped already
    }

    logger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Catch unhandled errors
  process.on("unhandledRejection", (reason) => {
    logger.error({ error: reason }, "Unhandled rejection");
    void notifyAdmins(
      `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`,
      "error",
    );
  });

  process.on("uncaughtException", (error) => {
    logger.fatal({ error }, "Uncaught exception — shutting down");
    void shutdown("uncaughtException");
  });
}

// ============================================================
// Entry point
// ============================================================

main().catch((err) => {
  logger.error({ error: err }, "Fatal startup error");
  process.exit(1);
});
