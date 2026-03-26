import "./setup-env.js";
import { describe, it, expect } from "vitest";
import {
  parseScheduleForQueue,
  findNextEvent,
  calculateScheduleHash,
} from "../src/services/api.js";
import type { RegionData } from "../src/services/api.js";
import type { ScheduleEvent } from "../src/formatters/schedule.js";

function makeRegionData(overrides: Partial<RegionData> = {}): RegionData {
  return {
    regionId: "kyiv",
    regionAffiliation: "м. Київ",
    lastUpdated: "2026-03-25T10:00:00.000Z",
    fact: {},
    preset: {},
    lastUpdateStatus: {
      status: "parsed",
      ok: true,
      code: 200,
      message: null,
      at: "2026-03-25T10:00:00.000Z",
      attempt: 1,
    },
    meta: {
      schemaVersion: "1.0.0",
      contentHash: "abc123",
    },
    ...overrides,
  };
}

describe("parseScheduleForQueue", () => {
  it("returns empty arrays for empty data", () => {
    const data = makeRegionData();
    const result = parseScheduleForQueue(data, "1.1");
    expect(result.today).toEqual([]);
    expect(result.tomorrow).toEqual([]);
  });

  it("parses fact.groups[queue].today structure", () => {
    const data = makeRegionData({
      fact: {
        groups: {
          "1.1": {
            today: {
              slots: [
                { start: "08:00", end: "12:00", type: "confirmed" },
                { start: "18:00", end: "22:00", type: "possible" },
              ],
            },
          },
        },
      },
    });

    const result = parseScheduleForQueue(data, "1.1");
    expect(result.today).toHaveLength(2);
    expect(result.today[0]).toEqual({
      start: "08:00",
      end: "12:00",
      durationMinutes: 240,
      isPossible: false,
      isNew: false,
    });
    expect(result.today[1]?.isPossible).toBe(true);
  });

  it("parses fact[today][queue] inverted structure", () => {
    const data = makeRegionData({
      fact: {
        today: {
          "1.2": [
            { start: "06:00", end: "10:00" },
          ],
        },
      },
    });

    const result = parseScheduleForQueue(data, "1.2");
    expect(result.today).toHaveLength(1);
    expect(result.today[0]?.start).toBe("06:00");
    expect(result.today[0]?.durationMinutes).toBe(240);
  });

  it("falls back to preset when fact has no data", () => {
    const data = makeRegionData({
      fact: {},
      preset: {
        groups: {
          "2.1": {
            today: {
              slots: [{ start: "14:00", end: "18:00" }],
            },
          },
        },
      },
    });

    const result = parseScheduleForQueue(data, "2.1");
    expect(result.today).toHaveLength(1);
    expect(result.today[0]?.start).toBe("14:00");
  });

  it("normalizes time formats", () => {
    const data = makeRegionData({
      fact: {
        groups: {
          "3.1": {
            today: {
              slots: [
                { start: "8:00", end: "12:00:00" },
              ],
            },
          },
        },
      },
    });

    const result = parseScheduleForQueue(data, "3.1");
    expect(result.today).toHaveLength(1);
    expect(result.today[0]?.start).toBe("08:00");
    expect(result.today[0]?.end).toBe("12:00");
  });

  it("handles periods format", () => {
    const data = makeRegionData({
      fact: {
        groups: {
          "4.1": {
            today: {
              periods: [
                { start: "10:00", end: "14:00", type: "maybe" },
              ],
            },
          },
        },
      },
    });

    const result = parseScheduleForQueue(data, "4.1");
    expect(result.today).toHaveLength(1);
    expect(result.today[0]?.isPossible).toBe(true);
  });

  it("sorts events by start time", () => {
    const data = makeRegionData({
      fact: {
        groups: {
          "1.1": {
            today: {
              slots: [
                { start: "18:00", end: "22:00" },
                { start: "06:00", end: "10:00" },
                { start: "12:00", end: "14:00" },
              ],
            },
          },
        },
      },
    });

    const result = parseScheduleForQueue(data, "1.1");
    expect(result.today).toHaveLength(3);
    expect(result.today[0]?.start).toBe("06:00");
    expect(result.today[1]?.start).toBe("12:00");
    expect(result.today[2]?.start).toBe("18:00");
  });
});

describe("findNextEvent", () => {
  const events: ScheduleEvent[] = [
    { start: "08:00", end: "12:00", durationMinutes: 240, isPossible: false, isNew: false },
    { start: "16:00", end: "20:00", durationMinutes: 240, isPossible: false, isNew: false },
  ];

  it("returns next off event when before first event", () => {
    const result = findNextEvent(events, "06:00");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("off");
    expect(result?.event.start).toBe("08:00");
    expect(result?.minutesUntil).toBe(120);
  });

  it("returns on event when during an outage", () => {
    const result = findNextEvent(events, "10:00");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("on");
    expect(result?.event.end).toBe("12:00");
    expect(result?.minutesUntil).toBe(120);
  });

  it("returns next off event when between outages", () => {
    const result = findNextEvent(events, "14:00");
    expect(result).not.toBeNull();
    expect(result?.type).toBe("off");
    expect(result?.event.start).toBe("16:00");
    expect(result?.minutesUntil).toBe(120);
  });

  it("returns null when after all events", () => {
    const result = findNextEvent(events, "21:00");
    expect(result).toBeNull();
  });

  it("returns null for empty events", () => {
    const result = findNextEvent([], "10:00");
    expect(result).toBeNull();
  });
});

describe("calculateScheduleHash", () => {
  it("returns consistent hash for same events", () => {
    const events: ScheduleEvent[] = [
      { start: "08:00", end: "12:00", durationMinutes: 240, isPossible: false, isNew: false },
    ];
    const hash1 = calculateScheduleHash(events);
    const hash2 = calculateScheduleHash(events);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64); // SHA-256 hex length
  });

  it("returns different hash for different events", () => {
    const events1: ScheduleEvent[] = [
      { start: "08:00", end: "12:00", durationMinutes: 240, isPossible: false, isNew: false },
    ];
    const events2: ScheduleEvent[] = [
      { start: "08:00", end: "14:00", durationMinutes: 360, isPossible: false, isNew: false },
    ];
    expect(calculateScheduleHash(events1)).not.toBe(calculateScheduleHash(events2));
  });

  it("returns different hash when isPossible differs", () => {
    const events1: ScheduleEvent[] = [
      { start: "08:00", end: "12:00", durationMinutes: 240, isPossible: false, isNew: false },
    ];
    const events2: ScheduleEvent[] = [
      { start: "08:00", end: "12:00", durationMinutes: 240, isPossible: true, isNew: false },
    ];
    expect(calculateScheduleHash(events1)).not.toBe(calculateScheduleHash(events2));
  });

  it("returns consistent hash for empty events", () => {
    expect(calculateScheduleHash([])).toBe(calculateScheduleHash([]));
  });
});
