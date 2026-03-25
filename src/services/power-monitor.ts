import type { Bot } from "grammy";
import type { BotContext } from "../bot.js";
import type { Database } from "../db/client.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { getUsersWithIp } from "../db/queries/users.js";
import {
  getAllPowerStates,
  upsertPowerState,
  addPowerHistoryEntry,
  startOutage,
  addPingErrorAlert,
} from "../db/queries/power.js";
import { updatePowerTracking } from "../db/queries/users.js";

// ============================================================
// Types
// ============================================================

interface UserPingTarget {
  userId: number;
  telegramId: string;
  routerIp: string;
  region: string;
  queue: string;
}

interface PowerState {
  state: "online" | "offline" | null;
  lastCheckedAt: Date | null;
  lastChangedAt: Date | null;
  // Debounce
  pendingState: "online" | "offline" | null;
  pendingChangedAt: Date | null;
}

// ============================================================
// Module state
// ============================================================

/** In-memory power states keyed by telegramId */
const states = new Map<string, PowerState>();

let isRunning = false;
let db: Database | null = null;
let bot: Bot<BotContext> | null = null;

// Concurrency limiter
let activeCount = 0;
const maxConcurrent = config.POWER_MAX_CONCURRENT_PINGS;
const waitQueue: Array<() => void> = [];

// ============================================================
// Public API
// ============================================================

/**
 * Initialize power monitor — load persisted states from DB.
 */
export async function initPowerMonitor(
  database: Database,
  botInstance: Bot<BotContext>,
): Promise<void> {
  db = database;
  bot = botInstance;

  // Load persisted states
  const persisted = await getAllPowerStates(database);
  for (const row of persisted) {
    states.set(row.telegramId, {
      state: (row.powerState as "online" | "offline" | null) ?? null,
      lastCheckedAt: row.lastCheckedAt,
      lastChangedAt: row.lastChangedAt,
      pendingState: null,
      pendingChangedAt: null,
    });
  }

  isRunning = true;
  logger.info({ usersLoaded: persisted.length }, "Power monitor initialized");
}

/**
 * Run a single check cycle — ping all users with IP.
 */
export async function runPingCycle(): Promise<{
  total: number;
  online: number;
  offline: number;
  errors: number;
}> {
  if (db === null || bot === null || !isRunning) {
    return { total: 0, online: 0, offline: 0, errors: 0 };
  }

  const users = await getUsersWithIp(db);
  const targets: UserPingTarget[] = users
    .filter((u) => u.routerIp != null && u.routerIp.length > 0)
    .map((u) => ({
      userId: u.id,
      telegramId: u.telegramId,
      routerIp: u.routerIp!,
      region: u.region,
      queue: u.queue,
    }));

  if (targets.length === 0) {
    return { total: 0, online: 0, offline: 0, errors: 0 };
  }

  let online = 0;
  let offline = 0;
  let errors = 0;

  const promises = targets.map(async (target) => {
    try {
      await acquireConcurrencySlot();
      const isOnline = await pingHost(target.routerIp);
      releaseConcurrencySlot();

      const newState: "online" | "offline" = isOnline ? "online" : "offline";
      if (isOnline) online++;
      else offline++;

      await handleStateChange(target, newState);
    } catch (err) {
      releaseConcurrencySlot();
      errors++;
      logger.warn(
        { error: err, telegramId: target.telegramId, ip: target.routerIp },
        "Ping error",
      );
    }
  });

  await Promise.allSettled(promises);

  return { total: targets.length, online, offline, errors };
}

/**
 * Stop the power monitor gracefully.
 */
export async function stopPowerMonitor(): Promise<void> {
  isRunning = false;

  // Persist all states to DB
  if (db !== null) {
    const persistPromises: Promise<void>[] = [];
    for (const [telegramId, state] of states) {
      persistPromises.push(
        upsertPowerState(db, telegramId, {
          powerState: state.state,
          lastCheckedAt: state.lastCheckedAt,
          lastChangedAt: state.lastChangedAt,
        }),
      );
    }
    await Promise.allSettled(persistPromises);
  }

  states.clear();
  logger.info("Power monitor stopped");
}

/**
 * Get monitor status for health check.
 */
export function getPowerMonitorStatus(): {
  isRunning: boolean;
  trackedUsers: number;
} {
  return {
    isRunning,
    trackedUsers: states.size,
  };
}

/**
 * Ping a single host. Exported for use by IP settings handler.
 */
export async function pingHost(host: string): Promise<boolean> {
  const url = host.includes("://") ? host : `http://${host}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.POWER_PING_TIMEOUT_MS,
    );
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "manual",
    });
    clearTimeout(timeout);
    return response.status > 0;
  } catch {
    return false;
  }
}

// ============================================================
// Internal: State change handling with debounce
// ============================================================

async function handleStateChange(
  target: UserPingTarget,
  newState: "online" | "offline",
): Promise<void> {
  if (db === null || bot === null) return;

  const now = new Date();
  let current = states.get(target.telegramId);

  if (current === undefined) {
    // First time seeing this user — initialize without notification
    current = {
      state: newState,
      lastCheckedAt: now,
      lastChangedAt: now,
      pendingState: null,
      pendingChangedAt: null,
    };
    states.set(target.telegramId, current);

    await upsertPowerState(db, target.telegramId, {
      routerIp: target.routerIp,
      powerState: newState,
      lastCheckedAt: now,
      lastChangedAt: now,
    });
    return;
  }

  current.lastCheckedAt = now;

  // Same state — clear any pending change
  if (newState === current.state) {
    if (current.pendingState !== null) {
      current.pendingState = null;
      current.pendingChangedAt = null;
    }
    await upsertPowerState(db, target.telegramId, {
      routerIp: target.routerIp,
      powerState: current.state,
      lastCheckedAt: now,
    });
    return;
  }

  // State changed — start or check debounce
  const debounceMs = config.POWER_DEBOUNCE_MINUTES * 60_000;

  if (current.pendingState !== newState) {
    // New pending state — start debounce window
    current.pendingState = newState;
    current.pendingChangedAt = now;
    return;
  }

  // Same pending state — check if debounce window has elapsed
  if (current.pendingChangedAt === null) {
    current.pendingChangedAt = now;
    return;
  }

  const elapsed = now.getTime() - current.pendingChangedAt.getTime();
  if (elapsed < debounceMs) {
    // Still within debounce window
    return;
  }

  // Debounce window passed — confirm state change
  const oldState = current.state;
  current.state = newState;
  current.lastChangedAt = now;
  current.pendingState = null;
  current.pendingChangedAt = null;

  // Persist to DB
  await upsertPowerState(db, target.telegramId, {
    routerIp: target.routerIp,
    powerState: newState,
    lastCheckedAt: now,
    lastChangedAt: now,
  });

  // Record history
  await addPowerHistoryEntry(db, target.userId, newState);

  // Track outage
  if (newState === "offline") {
    await startOutage(db, target.userId, "ip");
  }

  // Update power tracking in user's profile
  await updatePowerTracking(db, target.userId, {
    powerState: newState,
    powerChangedAt: now,
    lastPowerState: oldState,
    pendingPowerState: null,
    pendingPowerChangeAt: null,
  });

  // Send notification
  await sendPowerNotification(target, oldState, newState);
}

// ============================================================
// Internal: Notifications
// ============================================================

async function sendPowerNotification(
  target: UserPingTarget,
  oldState: string | null,
  newState: "online" | "offline",
): Promise<void> {
  if (bot === null) return;

  const emoji = newState === "online" ? "🟢" : "🔴";
  const statusText = newState === "online" ? "Світло з'явилось!" : "Світло зникло!";
  const text = `${emoji} <b>${statusText}</b>\n\n📡 IP: ${target.routerIp}`;

  try {
    await bot.api.sendMessage(target.telegramId, text, { parse_mode: "HTML" });
    logger.info(
      {
        telegramId: target.telegramId,
        oldState,
        newState,
        ip: target.routerIp,
      },
      "Power notification sent",
    );
  } catch (err) {
    logger.warn(
      { error: err, telegramId: target.telegramId },
      "Failed to send power notification",
    );
  }
}

// ============================================================
// Internal: Concurrency limiter (simple semaphore)
// ============================================================

function acquireConcurrencySlot(): Promise<void> {
  if (activeCount < maxConcurrent) {
    activeCount++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeCount++;
      resolve();
    });
  });
}

function releaseConcurrencySlot(): void {
  activeCount--;
  const next = waitQueue.shift();
  if (next !== undefined) {
    next();
  }
}
