import { logger } from "../utils/logger.js";

// ============================================================
// Types
// ============================================================

interface MetricCounters {
  messagesReceived: number;
  messagesSent: number;
  messagesFailed: number;
  callbacksProcessed: number;
  scheduleChecks: number;
  scheduleChangesDetected: number;
  pingChecks: number;
  pingFailures: number;
  errors: number;
  retryQueueEnqueued: number;
  retryQueueDropped: number;
}

interface MetricGauges {
  activeUsers: number;
  connectedChannels: number;
  dbLatencyMs: number;
}

interface DurationHistogram {
  count: number;
  sum: number;
  min: number;
  max: number;
}

// ============================================================
// Metrics singleton
// ============================================================

const counters: MetricCounters = {
  messagesReceived: 0,
  messagesSent: 0,
  messagesFailed: 0,
  callbacksProcessed: 0,
  scheduleChecks: 0,
  scheduleChangesDetected: 0,
  pingChecks: 0,
  pingFailures: 0,
  errors: 0,
  retryQueueEnqueued: 0,
  retryQueueDropped: 0,
};

const gauges: MetricGauges = {
  activeUsers: 0,
  connectedChannels: 0,
  dbLatencyMs: 0,
};

const handlerDuration: DurationHistogram = {
  count: 0,
  sum: 0,
  min: Infinity,
  max: 0,
};

// ============================================================
// Public API
// ============================================================

/**
 * Increment a counter by a given value (default 1).
 */
export function increment(counter: keyof MetricCounters, value = 1): void {
  counters[counter] += value;
}

/**
 * Set a gauge to a specific value.
 */
export function setGauge(gauge: keyof MetricGauges, value: number): void {
  gauges[gauge] = value;
}

/**
 * Record a handler duration in milliseconds.
 */
export function recordDuration(ms: number): void {
  handlerDuration.count++;
  handlerDuration.sum += ms;
  if (ms < handlerDuration.min) handlerDuration.min = ms;
  if (ms > handlerDuration.max) handlerDuration.max = ms;
}

/**
 * Get all metrics as a JSON-serializable object.
 */
export function getMetrics(): {
  counters: MetricCounters;
  gauges: MetricGauges & { uptimeSeconds: number };
  handlerDuration: DurationHistogram & { avg: number };
  memory: NodeJS.MemoryUsage;
  timestamp: string;
} {
  const avg = handlerDuration.count > 0 ? handlerDuration.sum / handlerDuration.count : 0;

  return {
    counters: { ...counters },
    gauges: {
      ...gauges,
      uptimeSeconds: Math.round(process.uptime()),
    },
    handlerDuration: {
      ...handlerDuration,
      min: handlerDuration.min === Infinity ? 0 : handlerDuration.min,
      avg: Math.round(avg * 100) / 100,
    },
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Reset all metrics (useful for testing).
 */
export function resetMetrics(): void {
  for (const key of Object.keys(counters) as Array<keyof MetricCounters>) {
    counters[key] = 0;
  }
  for (const key of Object.keys(gauges) as Array<keyof MetricGauges>) {
    gauges[key] = 0;
  }
  handlerDuration.count = 0;
  handlerDuration.sum = 0;
  handlerDuration.min = Infinity;
  handlerDuration.max = 0;
  logger.debug("Metrics reset");
}
