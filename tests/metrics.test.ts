import "./setup-env.js";
import { describe, it, expect, beforeEach } from "vitest";
import { increment, setGauge, recordDuration, getMetrics, resetMetrics } from "../src/services/metrics.js";

describe("Metrics", () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe("increment", () => {
    it("should increment a counter by 1 by default", () => {
      increment("messagesReceived");
      increment("messagesReceived");
      const metrics = getMetrics();
      expect(metrics.counters.messagesReceived).toBe(2);
    });

    it("should increment a counter by a given value", () => {
      increment("pingFailures", 5);
      const metrics = getMetrics();
      expect(metrics.counters.pingFailures).toBe(5);
    });

    it("should track multiple counters independently", () => {
      increment("messagesReceived", 3);
      increment("callbacksProcessed", 7);
      increment("errors");
      const metrics = getMetrics();
      expect(metrics.counters.messagesReceived).toBe(3);
      expect(metrics.counters.callbacksProcessed).toBe(7);
      expect(metrics.counters.errors).toBe(1);
    });
  });

  describe("setGauge", () => {
    it("should set a gauge value", () => {
      setGauge("activeUsers", 42);
      const metrics = getMetrics();
      expect(metrics.gauges.activeUsers).toBe(42);
    });

    it("should overwrite previous gauge value", () => {
      setGauge("dbLatencyMs", 10);
      setGauge("dbLatencyMs", 25);
      const metrics = getMetrics();
      expect(metrics.gauges.dbLatencyMs).toBe(25);
    });
  });

  describe("recordDuration", () => {
    it("should track handler duration stats", () => {
      recordDuration(100);
      recordDuration(200);
      recordDuration(50);
      const metrics = getMetrics();
      expect(metrics.handlerDuration.count).toBe(3);
      expect(metrics.handlerDuration.sum).toBe(350);
      expect(metrics.handlerDuration.min).toBe(50);
      expect(metrics.handlerDuration.max).toBe(200);
      expect(metrics.handlerDuration.avg).toBeCloseTo(116.67, 1);
    });

    it("should return 0 for min/avg when no durations recorded", () => {
      const metrics = getMetrics();
      expect(metrics.handlerDuration.count).toBe(0);
      expect(metrics.handlerDuration.min).toBe(0);
      expect(metrics.handlerDuration.avg).toBe(0);
    });
  });

  describe("getMetrics", () => {
    it("should include uptime and timestamp", () => {
      const metrics = getMetrics();
      expect(metrics.gauges.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(metrics.timestamp).toBeDefined();
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.heapUsed).toBeGreaterThan(0);
    });
  });

  describe("resetMetrics", () => {
    it("should reset all counters and gauges", () => {
      increment("messagesReceived", 10);
      setGauge("activeUsers", 50);
      recordDuration(100);
      resetMetrics();

      const metrics = getMetrics();
      expect(metrics.counters.messagesReceived).toBe(0);
      expect(metrics.gauges.activeUsers).toBe(0);
      expect(metrics.handlerDuration.count).toBe(0);
    });
  });
});
