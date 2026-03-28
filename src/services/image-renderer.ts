import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { logger } from "../utils/logger.js";
import type { RegionData } from "./api.js";

// ============================================================
// Types
// ============================================================

/** Cell state from the schedule JSON */
type CellState = "yes" | "no" | "maybe" | "mfirst" | "msecond";

/** Extracted grid: 2 rows (today/tomorrow) x 24 columns (hours) */
export interface ScheduleGrid {
  todayLabel: string;
  tomorrowLabel: string;
  todayCells: CellState[];
  tomorrowCells: CellState[];
  todayMissing: boolean;
  tomorrowMissing: boolean;
}

// ============================================================
// Satori element helper
// ============================================================

type SatoriNode = string | SatoriElement | null | undefined;

interface SatoriElement {
  type: string;
  props: Record<string, unknown> & {
    children?: SatoriNode | SatoriNode[];
    style?: Record<string, unknown>;
  };
}

function el(
  type: string,
  style: Record<string, unknown>,
  ...children: SatoriNode[]
): SatoriElement {
  const flat = children.length === 1 ? children[0] : children;
  return { type, props: { style, children: flat } };
}

// ============================================================
// Font loading
// ============================================================

let fontRegular: Buffer | null = null;
let fontBold: Buffer | null = null;

const FONT_PATHS = [
  "/usr/share/fonts/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
];

const FONT_BOLD_PATHS = [
  "/usr/share/fonts/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
];

function loadFont(paths: string[]): Buffer {
  for (const p of paths) {
    try {
      return readFileSync(p);
    } catch {
      // try next
    }
  }
  throw new Error(`No font found. Tried: ${paths.join(", ")}`);
}

function getFonts(): Array<{
  name: string;
  data: Buffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal";
}> {
  if (fontRegular === null) {
    fontRegular = loadFont(FONT_PATHS);
  }
  if (fontBold === null) {
    fontBold = loadFont(FONT_BOLD_PATHS);
  }
  return [
    { name: "Sans", data: fontRegular, weight: 400, style: "normal" },
    { name: "Sans", data: fontBold, weight: 700, style: "normal" },
  ];
}

// ============================================================
// Data extraction
// ============================================================

function queueToGpvKey(queue: string): string {
  return `GPV${queue}`;
}

/** Format unix timestamp to "DD.MM" short date */
function formatDayLabelShort(unixTs: number): string {
  const date = new Date(unixTs * 1000);
  const day = date.toLocaleDateString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
  });
  return day;
}

/** Format lastUpdated ISO string to "HH:MM DD.MM" for compact badge */
export function formatUpdateDate(isoString: string): string {
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = date.toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" });
  const parts = d.split(".");
  if (parts.length === 3) {
    const dd = pad(Number(parts[0] ?? "0"));
    const mm = pad(Number(parts[1] ?? "0"));
    const h = date.toLocaleTimeString("uk-UA", {
      timeZone: "Europe/Kyiv",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${h} ${dd}.${mm}`;
  }
  return date.toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });
}

function extractDayCells(
  dayData: Record<string, unknown> | undefined,
  gpvKey: string,
): { cells: CellState[]; missing: boolean } {
  if (dayData === undefined) {
    return { cells: Array(24).fill("yes") as CellState[], missing: true };
  }

  const gpvData = dayData[gpvKey] as Record<string, string> | undefined;
  if (gpvData === undefined) {
    return { cells: Array(24).fill("yes") as CellState[], missing: true };
  }

  const cells: CellState[] = [];
  for (let hour = 1; hour <= 24; hour++) {
    const val = gpvData[String(hour)] ?? "yes";
    const state = (["yes", "no", "maybe", "mfirst", "msecond"].includes(val)
      ? val
      : "yes") as CellState;
    cells.push(state);
  }
  return { cells, missing: false };
}

export function extractQueueGrid(regionData: RegionData, queue: string): ScheduleGrid {
  const gpvKey = queueToGpvKey(queue);
  const factData = regionData.fact as Record<string, unknown> | undefined;
  const factDataMap = (factData?.["data"] ?? {}) as Record<string, Record<string, unknown>>;
  const presetData = regionData.preset as Record<string, unknown> | undefined;
  const presetDataMap = (presetData?.["data"] ?? {}) as Record<string, Record<string, unknown>>;

  const timestamps = Object.keys(factDataMap)
    .map(Number)
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  const todayTs = timestamps[0] ?? 0;
  const tomorrowTs = timestamps[1] ?? 0;

  let todayResult = extractDayCells(factDataMap[String(todayTs)], gpvKey);
  let tomorrowResult = extractDayCells(factDataMap[String(tomorrowTs)], gpvKey);

  if (todayResult.missing && todayTs > 0) {
    const dow = new Date(todayTs * 1000).getDay();
    const presetDow = dow === 0 ? 7 : dow;
    const presetDay = presetDataMap[gpvKey] as Record<string, Record<string, string>> | undefined;
    if (presetDay !== undefined) {
      const daySlots = presetDay[String(presetDow)];
      if (daySlots !== undefined) {
        todayResult = extractDayCells({ [gpvKey]: daySlots }, gpvKey);
      }
    }
  }

  if (tomorrowResult.missing && tomorrowTs > 0) {
    const dow = new Date(tomorrowTs * 1000).getDay();
    const presetDow = dow === 0 ? 7 : dow;
    const presetDay = presetDataMap[gpvKey] as Record<string, Record<string, string>> | undefined;
    if (presetDay !== undefined) {
      const daySlots = presetDay[String(presetDow)];
      if (daySlots !== undefined) {
        tomorrowResult = extractDayCells({ [gpvKey]: daySlots }, gpvKey);
      }
    }
  }

  return {
    todayLabel: todayTs > 0 ? formatDayLabelShort(todayTs) : "Сьогодні",
    tomorrowLabel: tomorrowTs > 0 ? formatDayLabelShort(tomorrowTs) : "Завтра",
    todayCells: todayResult.cells,
    tomorrowCells: tomorrowResult.cells,
    todayMissing: todayResult.missing,
    tomorrowMissing: tomorrowResult.missing,
  };
}

// ============================================================
// Cell colors (DTEK style)
// ============================================================

export function getCellStyle(state: CellState): { bg: string } {
  switch (state) {
    case "yes":
      return { bg: "#ffffff" };
    case "no":
      return { bg: "#d1d5db" };
    case "maybe":
      return { bg: "#fef9c3" };
    case "mfirst":
      return { bg: "#bfdbfe" };
    case "msecond":
      return { bg: "#93c5fd" };
  }
}

// ============================================================
// SVG icons (from outage-data-ua, simplified for satori)
// ============================================================

function legendIcon(type: "yes" | "no" | "mfirst" | "msecond"): SatoriElement {
  const size = 18;

  if (type === "yes") {
    // Yellow lightbulb circle
    return el("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: "50%",
      backgroundColor: "#fbbf24",
    },
      el("div", { display: "flex", fontSize: 10, lineHeight: 1 }, "💡"),
    );
  }

  if (type === "no") {
    // Gray box (power off)
    return el("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: 3,
      backgroundColor: "#d1d5db",
    });
  }

  // mfirst / msecond - split color box
  const leftColor = type === "msecond" ? "#93c5fd" : "#e5e7eb";
  const rightColor = type === "mfirst" ? "#bfdbfe" : "#e5e7eb";

  return el("div", {
    display: "flex",
    flexDirection: "row",
    width: size,
    height: size,
    borderRadius: 3,
    overflow: "hidden",
  },
    el("div", {
      display: "flex",
      width: size / 2,
      height: size,
      backgroundColor: leftColor,
    }),
    el("div", {
      display: "flex",
      width: size / 2,
      height: size,
      backgroundColor: rightColor,
    }),
  );
}

// ============================================================
// Time headers
// ============================================================

const TIME_HEADERS = [
  "00-01", "01-02", "02-03", "03-04", "04-05", "05-06",
  "06-07", "07-08", "08-09", "09-10", "10-11", "11-12",
  "12-13", "13-14", "14-15", "15-16", "16-17", "17-18",
  "18-19", "19-20", "20-21", "21-22", "22-23", "23-24",
];

// ============================================================
// Layout builder — compact DTEK-style
// ============================================================

function buildScheduleLayout(
  regionName: string,
  queue: string,
  updateDate: string,
  grid: ScheduleGrid,
): SatoriElement {
  const CELL_W = 30;
  const CELL_H = 32;
  const HEADER_H = 50;
  const LABEL_W = 50;
  const TABLE_W = LABEL_W + CELL_W * 24;

  // --- Header cell: vertical "00-01" ---
  function headerCell(text: string): SatoriElement {
    const chars = text.split("");
    return el("div", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: CELL_W,
      height: HEADER_H,
      borderRight: "1px solid #e5e7eb",
      borderBottom: "1px solid #d1d5db",
      fontSize: 8,
      color: "#6b7280",
      gap: 0,
      lineHeight: 1,
    }, ...chars.map((ch) =>
      el("div", { display: "flex", fontSize: 8, lineHeight: 1.1 }, ch),
    ));
  }

  // --- Data cell ---
  function dataCell(state: CellState): SatoriElement {
    const { bg } = getCellStyle(state);
    return el("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: CELL_W,
      height: CELL_H,
      backgroundColor: bg,
      borderRight: "1px solid #e5e7eb",
      borderBottom: "1px solid #e5e7eb",
    });
  }

  // --- Missing data row ---
  function missingRow(label: string): SatoriElement {
    return el("div", { display: "flex", flexDirection: "row", height: CELL_H },
      el("div", {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: LABEL_W,
        fontSize: 11,
        fontWeight: 700,
        color: "#374151",
        borderRight: "1px solid #d1d5db",
        borderBottom: "1px solid #e5e7eb",
      }, label),
      el("div", {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: CELL_W * 24,
        height: CELL_H,
        fontSize: 11,
        color: "#9ca3af",
        borderBottom: "1px solid #e5e7eb",
      }, "Відсутні на сайті ДТЕК"),
    );
  }

  // --- Data row ---
  function dataRow(label: string, cells: CellState[], missing: boolean): SatoriElement {
    if (missing) return missingRow(label);

    return el("div", { display: "flex", flexDirection: "row", height: CELL_H },
      el("div", {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: LABEL_W,
        fontSize: 11,
        fontWeight: 700,
        color: "#374151",
        borderRight: "1px solid #d1d5db",
        borderBottom: "1px solid #e5e7eb",
      }, label),
      ...cells.map((s) => dataCell(s)),
    );
  }

  // --- Legend item ---
  function legendItemEl(icon: SatoriElement, text: string): SatoriElement {
    return el("div", {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
      icon,
      el("div", { display: "flex", fontSize: 10, color: "#6b7280" }, text),
    );
  }

  // --- Main layout ---
  return el("div", {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: 16,
    paddingBottom: 12,
    width: TABLE_W + 32,
    fontFamily: "Sans",
  },
    // Header row: update badge + region/queue badge
    el("div", {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
      // Left badge: "Оновлення від HH:MM DD.MM"
      el("div", {
        display: "flex",
        backgroundColor: "#f3f4f6",
        borderRadius: 6,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 5,
        fontSize: 11,
        color: "#6b7280",
        border: "1px solid #e5e7eb",
      }, `Оновлення від ${updateDate}`),
      // Right badge: "Регіон, Черга X.X"
      el("div", {
        display: "flex",
        backgroundColor: "#3b82f6",
        borderRadius: 6,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 5,
        paddingBottom: 5,
        fontSize: 12,
        fontWeight: 700,
        color: "#ffffff",
      }, `${regionName}, Черга ${queue}`),
    ),

    // Table
    el("div", {
      display: "flex",
      flexDirection: "column",
      border: "1px solid #d1d5db",
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: 10,
    },
      // Header row with time slots
      el("div", { display: "flex", flexDirection: "row" },
        el("div", {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: LABEL_W,
          height: HEADER_H,
          fontSize: 10,
          fontWeight: 700,
          color: "#6b7280",
          borderRight: "1px solid #d1d5db",
          borderBottom: "1px solid #d1d5db",
        }, "Час"),
        ...TIME_HEADERS.map((h) => headerCell(h)),
      ),
      // Today
      dataRow(grid.todayLabel, grid.todayCells, grid.todayMissing),
      // Tomorrow
      dataRow(grid.tomorrowLabel, grid.tomorrowCells, grid.tomorrowMissing),
    ),

    // Legend
    el("div", {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      flexWrap: "wrap",
    },
      legendItemEl(legendIcon("yes"), "Світло є"),
      legendItemEl(legendIcon("no"), "Світла немає"),
      legendItemEl(legendIcon("msecond"), "Світло буде другі 30 хв"),
      legendItemEl(legendIcon("mfirst"), "Світло буде перші 30 хв"),
    ),
  );
}

// ============================================================
// Public API
// ============================================================

export async function renderScheduleImage(
  regionData: RegionData,
  queue: string,
): Promise<Buffer> {
  const regionName = regionData.regionAffiliation;
  const updateDate = formatUpdateDate(regionData.lastUpdated);
  const grid = extractQueueGrid(regionData, queue);

  logger.debug({ regionName, queue, todayMissing: grid.todayMissing }, "Rendering schedule image");

  const layout = buildScheduleLayout(regionName, queue, updateDate, grid);

  const fonts = getFonts();

  const IMG_W = 802;
  const svg = await satori(layout as Parameters<typeof satori>[0], {
    width: IMG_W,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: IMG_W * 2 },
  });
  const rendered = resvg.render();
  const pngRaw = rendered.asPng();

  const optimized = await sharp(pngRaw).png({ quality: 80, compressionLevel: 8 }).toBuffer();

  logger.debug(
    { size: optimized.length, region: regionData.regionId, queue },
    "Schedule image rendered",
  );

  return optimized;
}
