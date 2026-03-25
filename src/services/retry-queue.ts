import type { Bot, RawApi } from "grammy";
import type { BotContext } from "../bot.js";
import { logger } from "../utils/logger.js";

// ============================================================
// Types
// ============================================================

type TelegramMethod = keyof RawApi;

interface QueuedMessage {
  id: string;
  chatId: string | number;
  method: TelegramMethod;
  params: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  createdAt: number;
}

// ============================================================
// Module state
// ============================================================

const queue: QueuedMessage[] = [];
let processing = false;
let bot: Bot<BotContext> | null = null;
let isRunning = false;
let processTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const PROCESS_INTERVAL_MS = 500;

// ============================================================
// Public API
// ============================================================

/**
 * Initialize the retry queue with a bot instance.
 */
export function initRetryQueue(botInstance: Bot<BotContext>): void {
  bot = botInstance;
  isRunning = true;
  scheduleProcessing();
  logger.info("Retry queue initialized");
}

/**
 * Enqueue a Telegram API call for sending with retry.
 */
export function enqueueMessage(
  chatId: string | number,
  method: TelegramMethod,
  params: Record<string, unknown>,
  maxAttempts = MAX_ATTEMPTS,
): void {
  queue.push({
    id: crypto.randomUUID(),
    chatId,
    method,
    params,
    attempts: 0,
    maxAttempts,
    nextRetryAt: Date.now(),
    createdAt: Date.now(),
  });
}

/**
 * Helper: enqueue a sendMessage call.
 */
export function enqueueSendMessage(
  chatId: string | number,
  text: string,
  options: Record<string, unknown> = {},
): void {
  enqueueMessage(chatId, "sendMessage", {
    chat_id: chatId,
    text,
    ...options,
  });
}

/**
 * Helper: enqueue a sendPhoto call.
 */
export function enqueueSendPhoto(
  chatId: string | number,
  photo: string | Buffer,
  options: Record<string, unknown> = {},
): void {
  enqueueMessage(chatId, "sendPhoto", {
    chat_id: chatId,
    photo,
    ...options,
  });
}

/**
 * Stop the retry queue. Processes remaining items before stopping.
 */
export async function stopRetryQueue(): Promise<void> {
  isRunning = false;
  if (processTimer !== null) {
    clearTimeout(processTimer);
    processTimer = null;
  }

  // Process remaining items (best effort)
  if (queue.length > 0) {
    logger.info({ remaining: queue.length }, "Processing remaining queue items before shutdown");
    await processQueue();
  }

  logger.info("Retry queue stopped");
}

/**
 * Get queue status for health check.
 */
export function getRetryQueueStatus(): {
  isRunning: boolean;
  queueSize: number;
  processing: boolean;
} {
  return {
    isRunning,
    queueSize: queue.length,
    processing,
  };
}

// ============================================================
// Internal: Queue processing
// ============================================================

function scheduleProcessing(): void {
  if (!isRunning) return;
  processTimer = setTimeout(() => {
    void processQueue()
      .catch((err) => {
        logger.error({ error: err }, "Retry queue processing error");
      })
      .finally(() => {
        scheduleProcessing();
      });
  }, PROCESS_INTERVAL_MS);
}

async function processQueue(): Promise<void> {
  if (processing || bot === null) return;
  processing = true;

  const now = Date.now();
  let processed = 0;

  try {
    while (queue.length > 0) {
      const msg = queue[0];
      if (msg === undefined) break;

      // Not ready for retry yet
      if (msg.nextRetryAt > now) break;

      queue.shift();
      msg.attempts++;

      try {
        // Call the Telegram API method
        await (bot.api.raw as unknown as Record<string, (params: Record<string, unknown>) => Promise<unknown>>)[msg.method]!(msg.params);
        processed++;

        // Rate limit: ~25 msg/sec
        if (processed % 25 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (err) {
        const error = err as { error_code?: number; description?: string };

        // 429 Too Many Requests
        if (error.error_code === 429) {
          const retryAfter = parseRetryAfter(error.description) ?? 5;
          msg.nextRetryAt = Date.now() + retryAfter * 1000;
          queue.push(msg);
          logger.warn(
            { chatId: msg.chatId, retryAfter, attempt: msg.attempts },
            "Telegram rate limited, re-queuing",
          );
          // Pause processing for retry-after duration
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        // 400/403 — permanent failures (blocked, chat not found)
        if (error.error_code === 400 || error.error_code === 403) {
          logger.warn(
            {
              chatId: msg.chatId,
              error: error.description,
              method: msg.method,
            },
            "Permanent send failure, dropping message",
          );
          continue;
        }

        // 5xx or other — retry with backoff
        if (msg.attempts < msg.maxAttempts) {
          const delay = getBackoffDelay(msg.attempts);
          msg.nextRetryAt = Date.now() + delay;
          queue.push(msg);
          logger.warn(
            {
              chatId: msg.chatId,
              attempt: msg.attempts,
              nextRetryMs: delay,
              error: error.description,
            },
            "Send failed, retrying",
          );
        } else {
          logger.error(
            {
              chatId: msg.chatId,
              attempts: msg.attempts,
              method: msg.method,
              error: error.description,
            },
            "Message dropped after max attempts",
          );
        }
      }
    }
  } finally {
    processing = false;
  }
}

function getBackoffDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  return BASE_DELAY_MS * Math.pow(2, attempt - 1);
}

function parseRetryAfter(description?: string): number | null {
  if (description === undefined) return null;
  const match = /retry after (\d+)/i.exec(description);
  if (match?.[1] !== undefined) {
    return parseInt(match[1], 10);
  }
  return null;
}
