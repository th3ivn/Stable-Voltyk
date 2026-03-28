import { describe, it, expect } from "vitest";
import {
  extractQueueGrid,
  getCellStyle,
  formatUpdateDate,
  renderScheduleImage,
} from "../src/services/image-renderer.js";
import type { RegionData } from "../src/services/api.js";

// ============================================================
// Mock data
// ============================================================

function makeRegionData(overrides?: {
  factData?: Record<string, Record<string, Record<string, string>>>;
}): RegionData {
  const factData = overrides?.factData ?? {
    "1774562400": {
      "GPV1.2": {
        "1": "maybe", "2": "maybe", "3": "yes", "4": "yes",
        "5": "yes", "6": "yes", "7": "yes", "8": "msecond",
        "9": "no", "10": "no", "11": "no", "12": "mfirst",
        "13": "yes", "14": "yes", "15": "yes", "16": "yes",
        "17": "maybe", "18": "maybe", "19": "yes", "20": "yes",
        "21": "yes", "22": "yes", "23": "yes", "24": "yes",
      },
    },
    "1774648800": {
      "GPV1.2": {
        "1": "yes", "2": "yes", "3": "yes", "4": "yes",
        "5": "maybe", "6": "maybe", "7": "maybe", "8": "maybe",
        "9": "mfirst", "10": "no", "11": "no", "12": "msecond",
        "13": "yes", "14": "yes", "15": "yes", "16": "yes",
        "17": "yes", "18": "yes", "19": "yes", "20": "yes",
        "21": "yes", "22": "yes", "23": "yes", "24": "yes",
      },
    },
  };

  return {
    regionId: "kyiv-region",
    regionAffiliation: "Київська обл.",
    lastUpdated: "2026-03-27T19:50:00.000Z",
    fact: { data: factData },
    preset: { data: {} },
    lastUpdateStatus: {
      status: "parsed",
      ok: true,
      code: 200,
      message: null,
      at: "2026-03-27T19:50:00.000Z",
      attempt: 1,
    },
    meta: { schemaVersion: "1.0.0", contentHash: "abc123" },
  };
}

// ============================================================
// Tests
// ============================================================

describe("getCellStyle", () => {
  it("returns white bg and no icon for 'yes'", () => {
    const style = getCellStyle("yes");
    expect(style.bg).toBe("#ffffff");
    expect(style.iconSrc).toBeNull();
  });

  it("returns white bg and icon for 'no'", () => {
    const style = getCellStyle("no");
    expect(style.bg).toBe("#ffffff");
    expect(style.iconSrc).not.toBeNull();
    expect(style.iconSrc).toContain("data:image/svg+xml;base64,");
  });

  it("returns white bg and icon for 'maybe'", () => {
    const style = getCellStyle("maybe");
    expect(style.bg).toBe("#ffffff");
    expect(style.iconSrc).not.toBeNull();
  });

  it("returns white bg and icon for 'mfirst'", () => {
    const style = getCellStyle("mfirst");
    expect(style.bg).toBe("#ffffff");
    expect(style.iconSrc).not.toBeNull();
  });

  it("returns white bg and icon for 'msecond'", () => {
    const style = getCellStyle("msecond");
    expect(style.bg).toBe("#ffffff");
    expect(style.iconSrc).not.toBeNull();
  });
});

describe("formatUpdateDate", () => {
  it("formats ISO string to HH:MM DD.MM", () => {
    const result = formatUpdateDate("2026-03-27T19:50:00.000Z");
    // In Europe/Kyiv timezone, 19:50 UTC = 21:50 or 22:50 depending on DST
    expect(result).toMatch(/^\d{2}:\d{2} 27\.03$/);
  });
});

describe("extractQueueGrid", () => {
  it("extracts cells for a queue with data", () => {
    const data = makeRegionData();
    const grid = extractQueueGrid(data, "1.2");

    expect(grid.todayCells).toHaveLength(24);
    expect(grid.tomorrowCells).toHaveLength(24);
    expect(grid.todayMissing).toBe(false);
    expect(grid.tomorrowMissing).toBe(false);

    // Check specific cells
    expect(grid.todayCells[0]).toBe("maybe");   // hour 1
    expect(grid.todayCells[8]).toBe("no");       // hour 9
    expect(grid.todayCells[11]).toBe("mfirst");  // hour 12
    expect(grid.todayCells[7]).toBe("msecond");  // hour 8
    expect(grid.todayCells[4]).toBe("yes");      // hour 5
  });

  it("marks rows as missing when no data", () => {
    const data = makeRegionData({ factData: {} });
    const grid = extractQueueGrid(data, "1.2");

    expect(grid.todayMissing).toBe(true);
    expect(grid.tomorrowMissing).toBe(true);
    expect(grid.todayCells).toHaveLength(24);
    expect(grid.todayCells.every((c) => c === "yes")).toBe(true);
  });

  it("marks row as missing when queue not in day data", () => {
    const data = makeRegionData({
      factData: {
        "1774562400": {
          "GPV3.1": {
            "1": "no", "2": "no", "3": "no", "4": "no",
            "5": "no", "6": "no", "7": "no", "8": "no",
            "9": "no", "10": "no", "11": "no", "12": "no",
            "13": "no", "14": "no", "15": "no", "16": "no",
            "17": "no", "18": "no", "19": "no", "20": "no",
            "21": "no", "22": "no", "23": "no", "24": "no",
          },
        },
      },
    });
    const grid = extractQueueGrid(data, "1.2");

    // GPV1.2 not present in data, should be missing
    expect(grid.todayMissing).toBe(true);
  });

  it("generates date labels with full month name", () => {
    const data = makeRegionData();
    const grid = extractQueueGrid(data, "1.2");

    // Labels should contain Ukrainian month name (e.g., "24 березня")
    expect(grid.todayLabel).toMatch(/\d+\s+\S+/);
    expect(grid.tomorrowLabel).toMatch(/\d+\s+\S+/);
  });

  it("shows missing when fact data absent even without preset fallback", () => {
    const data = makeRegionData({ factData: {} });
    // Add preset data - should NOT override missing flag
    (data.preset as Record<string, unknown>).data = {
      "GPV1.2": {
        "1": { "1": "no", "2": "no", "3": "yes" },
      },
    };
    const grid = extractQueueGrid(data, "1.2");

    // Should still be missing since fact data is absent
    expect(grid.todayMissing).toBe(true);
    expect(grid.tomorrowMissing).toBe(true);
  });
});

describe("renderScheduleImage", () => {
  it("returns a valid PNG buffer", async () => {
    const data = makeRegionData();
    const buffer = await renderScheduleImage(data, "1.2");

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Check PNG magic bytes: 0x89 P N G
    expect(buffer[0]).toBe(0x89);
    expect(buffer[1]).toBe(0x50); // P
    expect(buffer[2]).toBe(0x4e); // N
    expect(buffer[3]).toBe(0x47); // G
  });

  it("renders with empty data (missing rows)", async () => {
    const data = makeRegionData({ factData: {} });
    const buffer = await renderScheduleImage(data, "1.2");

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // PNG magic
    expect(buffer[0]).toBe(0x89);
  });
}, 15_000); // Allow 15s for rendering
