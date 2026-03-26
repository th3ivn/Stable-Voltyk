import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { sha256 } from "../utils/helpers.js";
import { AppError, ErrorCode, CircuitBreakerOpenError } from "../utils/errors.js";
import type { ScheduleEvent } from "../formatters/schedule.js";
import { notifyAdmins } from "./admin-notify.js";

// ============================================================
// Types
// ============================================================

/** Raw JSON structure from GitHub data source */
export interface RegionData {
  regionId: string;
  regionAffiliation: string;
  lastUpdated: string;
  fact: Record<string, unknown>;
  preset: Record<string, unknown>;
  lastUpdateStatus: {
    status: "parsed" | "error";
    ok: boolean;
    code: number;
    message: string | null;
    at: string;
    attempt: number;
  };
  meta: {
    schemaVersion: string;
    contentHash: string;
  };
}

/** A single time slot from the schedule data */
interface TimeSlot {
  start: string;
  end: string;
  type?: string;
}

/** Parsed queue day data */
interface QueueDayData {
  slots?: TimeSlot[];
  periods?: Array<{
    start: string;
    end: string;
    type?: string;
  }>;
}

// ============================================================
// Circuit Breaker
// ============================================================

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 60_000,
    private readonly onOpen?: () => void,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        logger.info({ breaker: this.name }, "Circuit breaker half-open, trying request");
      } else {
        throw new CircuitBreakerOpenError(this.name);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      logger.info({ breaker: this.name }, "Circuit breaker closed (recovered)");
      void notifyAdmins(`Circuit breaker <b>${this.name}</b> recovered (CLOSED)`, "info");
    }
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      const wasAlreadyOpen = this.state === CircuitState.OPEN;
      this.state = CircuitState.OPEN;
      if (!wasAlreadyOpen) {
        logger.error(
          { breaker: this.name, failures: this.failureCount },
          "Circuit breaker opened",
        );
        this.onOpen?.();
      }
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// ============================================================
// In-memory cache
// ============================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class TtlCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();

  constructor(
    private readonly ttlMs: number = 120_000,
    private readonly maxEntries: number = 100,
  ) {}

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry === undefined) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    // Evict oldest if at max capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================
// Module state
// ============================================================

const githubBreaker = new CircuitBreaker("github", 5, 60_000, () => {
  void notifyAdmins("Circuit breaker <b>github</b> OPEN — data source unavailable", "error");
});
const jsonCache = new TtlCache<RegionData>(120_000, 20);
const imageCache = new TtlCache<Buffer>(120_000, 50);
let lastETag: string | null = null;

// ============================================================
// Public API
// ============================================================

/**
 * Fetch schedule JSON for a region (with cache + circuit breaker).
 */
export async function getScheduleData(region: string): Promise<RegionData | null> {
  const cached = jsonCache.get(region);
  if (cached !== null) return cached;

  try {
    const data = await githubBreaker.execute(() => fetchJson(region));
    jsonCache.set(region, data);
    return data;
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      logger.warn({ region }, "GitHub circuit breaker open, skipping schedule fetch");
      return null;
    }
    logger.error({ error, region }, "Failed to fetch schedule data");
    return null;
  }
}

/**
 * Fetch schedule image (PNG) for a region + queue.
 */
export async function getScheduleImage(
  region: string,
  queue: string,
): Promise<Buffer | null> {
  const cacheKey = `${region}:${queue}`;
  const cached = imageCache.get(cacheKey);
  if (cached !== null) return cached;

  try {
    const buffer = await githubBreaker.execute(() => fetchImage(region, queue));
    imageCache.set(cacheKey, buffer);
    return buffer;
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      logger.warn({ region, queue }, "GitHub circuit breaker open, skipping image fetch");
      return null;
    }
    logger.error({ error, region, queue }, "Failed to fetch schedule image");
    return null;
  }
}

/**
 * Check GitHub commits API for data updates (ETag-based).
 * Returns true if new data is available.
 */
export async function checkForUpdates(): Promise<boolean> {
  try {
    const result = await githubBreaker.execute(() => checkGitHubCommits());
    if (result.hasUpdates) {
      // Clear cache to force re-fetch
      jsonCache.clear();
      imageCache.clear();
      logger.info("Schedule data updated, cache cleared");
    }
    return result.hasUpdates;
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      return false;
    }
    logger.error({ error }, "Failed to check GitHub for updates");
    return false;
  }
}

/**
 * Parse schedule events for a specific queue from region data.
 */
export function parseScheduleForQueue(
  data: RegionData,
  queue: string,
): { today: ScheduleEvent[]; tomorrow: ScheduleEvent[] } {
  try {
    const todayEvents = extractEventsFromSection(data.fact, queue, "today");
    const tomorrowEvents = extractEventsFromSection(data.fact, queue, "tomorrow");

    // If no fact data, fall back to preset
    const todayFinal =
      todayEvents.length > 0
        ? todayEvents
        : extractEventsFromSection(data.preset, queue, "today");
    const tomorrowFinal =
      tomorrowEvents.length > 0
        ? tomorrowEvents
        : extractEventsFromSection(data.preset, queue, "tomorrow");

    return { today: todayFinal, tomorrow: tomorrowFinal };
  } catch (error) {
    logger.error({ error, queue }, "Failed to parse schedule for queue");
    return { today: [], tomorrow: [] };
  }
}

/**
 * Find the next upcoming event (power off or on).
 * Returns null if no events remain today.
 */
export function findNextEvent(
  events: ScheduleEvent[],
  currentTimeStr?: string,
): { event: ScheduleEvent; type: "off" | "on"; minutesUntil: number } | null {
  const now = currentTimeStr ?? getCurrentTimeKyiv();
  const nowMinutes = timeToMinutes(now);

  for (const event of events) {
    const startMinutes = timeToMinutes(event.start);
    const endMinutes = timeToMinutes(event.end);

    // Upcoming power off
    if (nowMinutes < startMinutes) {
      return {
        event,
        type: "off",
        minutesUntil: startMinutes - nowMinutes,
      };
    }

    // Currently in outage, power on upcoming
    if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
      return {
        event,
        type: "on",
        minutesUntil: endMinutes - nowMinutes,
      };
    }
  }

  return null;
}

/**
 * Calculate SHA-256 hash of schedule events for change detection.
 */
export function calculateScheduleHash(events: ScheduleEvent[]): string {
  const data = events
    .map((e) => `${e.start}-${e.end}-${e.isPossible ? "p" : "c"}-${e.isNew ? "n" : "o"}`)
    .join("|");
  return sha256(data);
}

/**
 * Force clear all caches.
 */
export function clearCaches(): void {
  jsonCache.clear();
  imageCache.clear();
  lastETag = null;
}

/**
 * Get circuit breaker state (for health check).
 */
export function getCircuitBreakerState(): string {
  return githubBreaker.getState();
}

// ============================================================
// Private helpers
// ============================================================

async function fetchJson(region: string): Promise<RegionData> {
  const url = config.DATA_URL_TEMPLATE.replace("{region}", region);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (config.GITHUB_TOKEN.length > 0) {
    headers["Authorization"] = `token ${config.GITHUB_TOKEN}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, 10_000);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (response.status === 404) {
      throw new AppError(ErrorCode.GITHUB_API_ERROR, `Region not found: ${region}`, {
        region,
        status: 404,
      });
    }

    if (response.status === 403 || response.status === 429) {
      throw new AppError(ErrorCode.GITHUB_RATE_LIMITED, "GitHub API rate limited", {
        region,
        status: response.status,
      });
    }

    if (!response.ok) {
      throw new AppError(ErrorCode.GITHUB_API_ERROR, `GitHub API error: ${response.status}`, {
        region,
        status: response.status,
      });
    }

    const data = (await response.json()) as RegionData;

    if (data.meta === undefined || data.fact === undefined) {
      throw new AppError(ErrorCode.SCHEDULE_PARSE_ERROR, "Invalid schedule data structure", {
        region,
      });
    }

    return data;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof AppError) throw error;

    const message = error instanceof Error ? error.message : "Unknown error";
    throw new AppError(ErrorCode.GITHUB_API_ERROR, `Fetch failed: ${message}`, {
      region,
      url,
    });
  }
}

async function fetchImage(region: string, queue: string): Promise<Buffer> {
  // Queue format: "1.2" → "1-2" for URL
  const queueForUrl = queue.replace(".", "-");
  const url = config.IMAGE_URL_TEMPLATE
    .replace("{region}", region)
    .replace("{queue}", queueForUrl);

  const headers: Record<string, string> = {};
  if (config.GITHUB_TOKEN.length > 0) {
    headers["Authorization"] = `token ${config.GITHUB_TOKEN}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, 15_000);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new AppError(ErrorCode.GITHUB_API_ERROR, `Image fetch failed: ${response.status}`, {
        region,
        queue,
        status: response.status,
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof AppError) throw error;

    const message = error instanceof Error ? error.message : "Unknown error";
    throw new AppError(ErrorCode.GITHUB_API_ERROR, `Image fetch failed: ${message}`, {
      region,
      queue,
    });
  }
}

async function checkGitHubCommits(): Promise<{
  hasUpdates: boolean;
  newETag: string | null;
}> {
  const url =
    "https://api.github.com/repos/Baskerville42/outage-data-ua/commits?per_page=1&path=data";

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (config.GITHUB_TOKEN.length > 0) {
    headers["Authorization"] = `token ${config.GITHUB_TOKEN}`;
  }
  if (lastETag !== null) {
    headers["If-None-Match"] = lastETag;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, 10_000);

  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);

    // 304 Not Modified — no changes
    if (response.status === 304) {
      return { hasUpdates: false, newETag: lastETag };
    }

    if (response.status === 403 || response.status === 429) {
      throw new AppError(ErrorCode.GITHUB_RATE_LIMITED, "GitHub API rate limited", {
        status: response.status,
      });
    }

    if (!response.ok) {
      throw new AppError(ErrorCode.GITHUB_API_ERROR, `GitHub commits API: ${response.status}`, {
        status: response.status,
      });
    }

    const newETag = response.headers.get("etag");
    if (newETag !== null) {
      lastETag = newETag;
    }

    return { hasUpdates: true, newETag };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof AppError) throw error;

    const message = error instanceof Error ? error.message : "Unknown error";
    throw new AppError(ErrorCode.GITHUB_API_ERROR, `GitHub commits check failed: ${message}`);
  }
}

/**
 * Extract schedule events from a section (fact or preset) for a given queue.
 *
 * The data structure from the GitHub source varies, so we handle multiple formats:
 * 1. Direct queue key: data["1.2"] or data["group_1_2"]
 * 2. Nested: data.groups["1.2"].today/tomorrow
 * 3. Array format: data[dayKey] with queue filtering
 */
function extractEventsFromSection(
  section: Record<string, unknown>,
  queue: string,
  day: "today" | "tomorrow",
): ScheduleEvent[] {
  if (section === undefined || section === null) return [];

  const events: ScheduleEvent[] = [];

  // Try multiple key formats
  const queueKeys = [
    queue,
    queue.replace(".", "_"),
    `group_${queue.replace(".", "_")}`,
    `gpv_${queue.replace(".", "_")}`,
  ];

  // Try: section.groups[queue][day]
  const groups = section["groups"] as Record<string, unknown> | undefined;
  if (groups !== undefined && groups !== null) {
    for (const key of queueKeys) {
      const queueData = groups[key] as Record<string, unknown> | undefined;
      if (queueData !== undefined) {
        const dayData = queueData[day] as QueueDayData | undefined;
        if (dayData !== undefined) {
          return parseDayData(dayData);
        }
      }
    }
  }

  // Try: section[queue][day]
  for (const key of queueKeys) {
    const queueData = section[key] as Record<string, unknown> | undefined;
    if (queueData !== undefined && queueData !== null) {
      const dayData = queueData[day] as QueueDayData | undefined;
      if (dayData !== undefined) {
        return parseDayData(dayData);
      }
      // Maybe dayData is directly the queue data for today
      if (day === "today" && Array.isArray(queueData["slots"])) {
        return parseDayData(queueData as unknown as QueueDayData);
      }
    }
  }

  // Try: section[day][queue] (inverted structure)
  const daySection = section[day] as Record<string, unknown> | undefined;
  if (daySection !== undefined && daySection !== null) {
    for (const key of queueKeys) {
      const queueData = daySection[key];
      if (queueData !== undefined && queueData !== null) {
        if (Array.isArray(queueData)) {
          return parseSlotArray(queueData);
        }
        return parseDayData(queueData as QueueDayData);
      }
    }
  }

  return events;
}

function parseDayData(dayData: QueueDayData): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];

  const items = dayData.slots ?? dayData.periods ?? [];
  for (const item of items) {
    const start = normalizeTime(item.start);
    const end = normalizeTime(item.end);
    if (start === null || end === null) continue;

    const durationMinutes = calculateDurationMinutes(start, end);
    events.push({
      start,
      end,
      durationMinutes,
      isPossible: item.type === "possible" || item.type === "maybe",
      isNew: false,
    });
  }

  return events.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

function parseSlotArray(slots: unknown[]): ScheduleEvent[] {
  const events: ScheduleEvent[] = [];

  for (const slot of slots) {
    if (typeof slot !== "object" || slot === null) continue;
    const s = slot as Record<string, unknown>;
    const start = normalizeTime(s["start"] as string | undefined);
    const end = normalizeTime(s["end"] as string | undefined);
    if (start === null || end === null) continue;

    events.push({
      start,
      end,
      durationMinutes: calculateDurationMinutes(start, end),
      isPossible:
        s["type"] === "possible" || s["type"] === "maybe",
      isNew: false,
    });
  }

  return events.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

function normalizeTime(time: string | undefined | null): string | null {
  if (time === undefined || time === null) return null;
  const trimmed = time.trim();

  // Already HH:MM
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  // H:MM → 0H:MM
  if (/^\d:\d{2}$/.test(trimmed)) return `0${trimmed}`;

  // HH:MM:SS → HH:MM
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 5);

  return null;
}

function timeToMinutes(time: string): number {
  const parts = time.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  return h * 60 + m;
}

function calculateDurationMinutes(start: string, end: string): number {
  const startM = timeToMinutes(start);
  let endM = timeToMinutes(end);
  if (endM <= startM) endM += 24 * 60; // crosses midnight
  return endM - startM;
}

function getCurrentTimeKyiv(): string {
  return new Date().toLocaleTimeString("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
