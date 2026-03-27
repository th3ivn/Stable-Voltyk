import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  // Alpine with font-noto
  "/usr/share/fonts/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  // Debian/Ubuntu
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  // Fallback
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

/** Map GPV key from queue: "1.2" -> "GPV1.2" */
function queueToGpvKey(queue: string): string {
  return `GPV${queue}`;
}

/** Format unix timestamp to "DD місяця" in Ukrainian */
function formatDayLabel(unixTs: number): string {
  const date = new Date(unixTs * 1000);
  const day = date.toLocaleDateString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "long",
  });
  return day;
}

/** Format lastUpdated ISO string to "DD.MM.YYYY HH:MM" */
export function formatUpdateDate(isoString: string): string {
  const date = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = date.toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" });
  const parts = d.split(".");
  if (parts.length === 3) {
    const dd = pad(Number(parts[0]));
    const mm = pad(Number(parts[1]));
    const yyyy = parts[2];
    const h = date.toLocaleTimeString("uk-UA", {
      timeZone: "Europe/Kyiv",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${dd}.${mm}.${yyyy} ${h}`;
  }
  // Fallback
  return date.toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });
}

/** Extract 24 cell states for a queue from a day's data */
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

/** Extract the full schedule grid for a queue from region data */
export function extractQueueGrid(regionData: RegionData, queue: string): ScheduleGrid {
  const gpvKey = queueToGpvKey(queue);
  const factData = regionData.fact as Record<string, unknown> | undefined;
  const factDataMap = (factData?.["data"] ?? {}) as Record<string, Record<string, unknown>>;
  const presetData = regionData.preset as Record<string, unknown> | undefined;
  const presetDataMap = (presetData?.["data"] ?? {}) as Record<string, Record<string, unknown>>;

  // Get timestamps from fact.data (sorted)
  const timestamps = Object.keys(factDataMap)
    .map(Number)
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  const todayTs = timestamps[0] ?? 0;
  const tomorrowTs = timestamps[1] ?? 0;

  // Try fact data first, fallback to preset
  let todayResult = extractDayCells(factDataMap[String(todayTs)], gpvKey);
  let tomorrowResult = extractDayCells(factDataMap[String(tomorrowTs)], gpvKey);

  // If fact data is missing, try preset data with day-of-week
  if (todayResult.missing && todayTs > 0) {
    const dow = new Date(todayTs * 1000).getDay(); // 0=Sun
    const presetDow = dow === 0 ? 7 : dow; // 1=Mon..7=Sun
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
    todayLabel: todayTs > 0 ? formatDayLabel(todayTs) : "Сьогодні",
    tomorrowLabel: tomorrowTs > 0 ? formatDayLabel(tomorrowTs) : "Завтра",
    todayCells: todayResult.cells,
    tomorrowCells: tomorrowResult.cells,
    todayMissing: todayResult.missing,
    tomorrowMissing: tomorrowResult.missing,
  };
}

// ============================================================
// Cell colors
// ============================================================

export function getCellStyle(state: CellState): { bg: string; icon: string | null } {
  switch (state) {
    case "yes":
      return { bg: "#ffffff", icon: null };
    case "no":
      return { bg: "#2d3748", icon: "⚡" };
    case "maybe":
      return { bg: "#fefce8", icon: null };
    case "mfirst":
      return { bg: "#fef3c7", icon: null };
    case "msecond":
      return { bg: "#fde68a", icon: null };
  }
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
// Layout builder (satori element tree)
// ============================================================

function buildScheduleLayout(
  regionName: string,
  queue: string,
  updateDate: string,
  grid: ScheduleGrid,
): SatoriElement {
  const CELL_W = 32;
  const CELL_H = 36;
  const HEADER_H = 44;
  const LABEL_W = 100;

  // --- Header cell: two-line format "00" / "01" ---
  function headerCell(text: string): SatoriElement {
    // "00-01" → top "00", bottom "01"
    const parts = text.split("-");
    const top = parts[0] ?? "";
    const bottom = parts[1] ?? "";
    return el("div", {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: CELL_W,
      height: HEADER_H,
      borderRight: "1px solid #e2e8f0",
      borderBottom: "1px solid #cbd5e1",
      color: "#374151",
      fontSize: 10,
      gap: 1,
    },
      el("div", { display: "flex", fontSize: 10, lineHeight: 1 }, top),
      el("div", { display: "flex", fontSize: 8, lineHeight: 1, color: "#9ca3af" }, "|"),
      el("div", { display: "flex", fontSize: 10, lineHeight: 1 }, bottom),
    );
  }

  // --- Data cell ---
  function dataCell(state: CellState): SatoriElement {
    const style = getCellStyle(state);
    return el("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: CELL_W,
      height: CELL_H,
      backgroundColor: style.bg,
      borderRight: "1px solid #e2e8f0",
      borderBottom: "1px solid #e2e8f0",
      fontSize: 10,
      color: "#ffffff",
    }, style.icon);
  }

  // --- Missing data row ---
  function missingRow(label: string): SatoriElement {
    return el("div", { display: "flex", flexDirection: "row", height: CELL_H },
      el("div", {
        display: "flex",
        alignItems: "center",
        width: LABEL_W,
        paddingLeft: 12,
        fontSize: 13,
        fontWeight: 700,
        color: "#0e1624",
        borderRight: "1px solid #cbd5e1",
        borderBottom: "1px solid #e2e8f0",
      }, label),
      el("div", {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: CELL_W * 24,
        height: CELL_H,
        fontSize: 12,
        color: "#6b7785",
        borderBottom: "1px solid #e2e8f0",
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
        width: LABEL_W,
        paddingLeft: 12,
        fontSize: 13,
        fontWeight: 700,
        color: "#0e1624",
        borderRight: "1px solid #cbd5e1",
        borderBottom: "1px solid #e2e8f0",
      }, label),
      ...cells.map((s) => dataCell(s)),
    );
  }

  // --- Legend item ---
  function legendItem(bg: string, text: string, icon?: string): SatoriElement {
    return el("div", {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginRight: 24,
    },
      el("div", {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        backgroundColor: bg,
        borderRadius: 4,
        border: "1px solid #e2e8f0",
        fontSize: 12,
        color: bg === "#2d3748" ? "#ffffff" : "#374151",
      }, icon ?? null),
      el("div", { display: "flex", fontSize: 12, color: "#374151" }, text),
    );
  }

  const TABLE_W = LABEL_W + CELL_W * 24;

  // --- Main layout ---
  return el("div", {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#f6f8fb",
    padding: 24,
    width: TABLE_W + 48 + 48, // table + card padding + outer padding
    fontFamily: "Sans",
  },
    // Card container
    el("div", {
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#ffffff",
      borderRadius: 12,
      padding: 24,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    },
      // Header row: title + queue badge
      el("div", {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 8,
      },
        el("div", {
          display: "flex",
          fontSize: 22,
          fontWeight: 700,
          color: "#0e1624",
        }, `Графік відключень (${regionName}):`),
        el("div", {
          display: "flex",
          backgroundColor: "#ffd666",
          borderRadius: 8,
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 8,
          paddingBottom: 8,
          fontSize: 18,
          fontWeight: 700,
          color: "#0e1624",
        }, `Черга ${queue}`),
      ),

      // Update date
      el("div", {
        display: "flex",
        fontSize: 11,
        color: "#9ca3af",
        marginBottom: 16,
      }, `Дата та час останнього оновлення інформації на графіку: ${updateDate}`),

      // Table
      el("div", {
        display: "flex",
        flexDirection: "column",
        border: "1px solid #cbd5e1",
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 20,
      },
        // Header row
        el("div", { display: "flex", flexDirection: "row" },
          el("div", {
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: LABEL_W,
            height: HEADER_H,
            paddingLeft: 8,
            fontSize: 11,
            fontWeight: 700,
            color: "#374151",
            borderRight: "1px solid #cbd5e1",
            borderBottom: "1px solid #cbd5e1",
          },
            el("div", { display: "flex" }, "Часові"),
            el("div", { display: "flex" }, "проміжки"),
          ),
          ...TIME_HEADERS.map((h) => headerCell(h)),
        ),
        // Today row
        dataRow(grid.todayLabel, grid.todayCells, grid.todayMissing),
        // Tomorrow row
        dataRow(grid.tomorrowLabel, grid.tomorrowCells, grid.tomorrowMissing),
      ),

      // Legend
      el("div", {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
      },
        legendItem("#ffffff", "Світло є"),
        legendItem("#2d3748", "Світла нема", "⚡"),
        legendItem("#fef3c7", "Перші 30 хв."),
        legendItem("#fde68a", "Другі 30 хв."),
      ),
    ),
  );
}

// ============================================================
// Public API
// ============================================================

/**
 * Render a schedule PNG image from region JSON data.
 * Returns a PNG Buffer ready to send via Telegram.
 */
export async function renderScheduleImage(
  regionData: RegionData,
  queue: string,
): Promise<Buffer> {
  const regionName = regionData.regionAffiliation ?? regionData.regionId;
  const updateDate = formatUpdateDate(regionData.lastUpdated);
  const grid = extractQueueGrid(regionData, queue);

  logger.debug({ regionName, queue, todayMissing: grid.todayMissing }, "Rendering schedule image");

  const layout = buildScheduleLayout(regionName, queue, updateDate, grid);

  const fonts = getFonts();

  const IMG_W = 950;
  const svg = await satori(layout as Parameters<typeof satori>[0], {
    width: IMG_W,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: IMG_W * 2 }, // 2x for Retina
  });
  const rendered = resvg.render();
  const pngRaw = rendered.asPng();

  // Optimize with sharp
  const optimized = await sharp(pngRaw).png({ quality: 80, compressionLevel: 8 }).toBuffer();

  logger.debug(
    { size: optimized.length, region: regionData.regionId, queue },
    "Schedule image rendered",
  );

  return optimized;
}
