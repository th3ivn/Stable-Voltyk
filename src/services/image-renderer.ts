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

/** Create an <img> element (satori supports img with src) */
function img(
  src: string,
  width: number,
  height: number,
  extraStyle?: Record<string, unknown>,
): SatoriElement {
  return {
    type: "img",
    props: {
      src,
      width,
      height,
      style: { ...extraStyle },
    },
  };
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
// SVG icons from outage-data-ua (base64 data URIs)
// ============================================================

// Lightning bolt paths (shared by all icons)
const BOLT_PATH_1 =
  "M18.75 17.8688L2.13125 1.25L1.25 2.13125L5.25 6.1375L4.375 9.85625C4.35295 9.94941 4.35259 10.0464 4.37396 10.1397C4.39532 10.233 4.43785 10.3202 4.49824 10.3945C4.55863 10.4688 4.63529 10.5282 4.72228 10.5682C4.80928 10.6081 4.9043 10.6276 5 10.625H8.01875L6.875 18.0313C6.85435 18.1685 6.88001 18.3088 6.94791 18.4299C7.01581 18.551 7.1221 18.646 7.25 18.7C7.32944 18.7323 7.41426 18.7492 7.5 18.75C7.59545 18.7498 7.68958 18.7277 7.77516 18.6854C7.86075 18.6432 7.93553 18.5819 7.99375 18.5063L12.1687 13.05L17.8688 18.75L18.75 17.8688Z";

const BOLT_PATH_2 =
  "M14.0813 10.5437L16.1188 7.88124C16.1844 7.79243 16.2254 7.68781 16.2374 7.57802C16.2495 7.46823 16.2323 7.35721 16.1875 7.25624C16.1405 7.14521 16.0624 7.05014 15.9626 6.9825C15.8628 6.91485 15.7455 6.87752 15.625 6.87499H12.6563L13.75 2.01249C13.7707 1.92026 13.7702 1.82452 13.7486 1.7325C13.7269 1.64049 13.6847 1.55458 13.625 1.48124C13.5649 1.40706 13.4885 1.34765 13.4019 1.30756C13.3152 1.26747 13.2205 1.24778 13.125 1.24999H6.875C6.73138 1.24615 6.59082 1.29191 6.47699 1.37957C6.36315 1.46722 6.28299 1.59141 6.25 1.73124L6.0625 2.54374L14.0813 10.5437Z";

function buildNoSvg(): string {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#c)"><path d="${BOLT_PATH_1}" fill="black"/><path d="${BOLT_PATH_2}" fill="black"/></g><defs><clipPath id="c"><rect width="20" height="20" fill="white"/></clipPath></defs></svg>`;
}

function buildMaybeSvg(): string {
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#c)"><path d="${BOLT_PATH_1}" fill="#9EA3A9"/><path d="${BOLT_PATH_2}" fill="#9EA3A9"/></g><defs><clipPath id="c"><rect width="20" height="20" fill="white"/></clipPath></defs></svg>`;
}

function buildMfirstSvg(): string {
  // Left half gray #9EA3A9, right half gold #F2B200
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><mask id="m0" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20"><g clip-path="url(#c0)"><path d="${BOLT_PATH_1}" fill="#F2B200"/><path d="${BOLT_PATH_2}" fill="#F2B200"/></g></mask><g mask="url(#m0)"><rect x="-4" y="-8" width="14" height="36" fill="#9EA3A9"/></g><mask id="m1" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20"><g clip-path="url(#c1)"><path d="${BOLT_PATH_1}" fill="black"/><path d="${BOLT_PATH_2}" fill="black"/></g></mask><g mask="url(#m1)"><rect x="10" y="-8" width="14" height="36" fill="#F2B200"/></g><defs><clipPath id="c0"><rect width="20" height="20" fill="white"/></clipPath><clipPath id="c1"><rect width="20" height="20" fill="white"/></clipPath></defs></svg>`;
}

function buildMsecondSvg(): string {
  // Left half gold #F2B200, right half gray #9EA3A9
  return `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><mask id="m0" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20"><g clip-path="url(#c0)"><path d="${BOLT_PATH_1}" fill="#F2B200"/><path d="${BOLT_PATH_2}" fill="#F2B200"/></g></mask><g mask="url(#m0)"><rect x="10" y="-8" width="14" height="36" fill="#9EA3A9"/></g><mask id="m1" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20"><g clip-path="url(#c1)"><path d="${BOLT_PATH_1}" fill="black"/><path d="${BOLT_PATH_2}" fill="black"/></g></mask><g mask="url(#m1)"><rect x="-4" y="-8" width="14" height="36" fill="#F2B200"/></g><defs><clipPath id="c0"><rect width="20" height="20" fill="white"/></clipPath><clipPath id="c1"><rect width="20" height="20" fill="white"/></clipPath></defs></svg>`;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Cached data URIs
let _iconUris: Record<CellState, string> | null = null;

function getIconUris(): Record<CellState, string> {
  if (_iconUris !== null) return _iconUris;
  _iconUris = {
    yes: "", // no icon for "yes"
    no: svgToDataUri(buildNoSvg()),
    maybe: svgToDataUri(buildMaybeSvg()),
    mfirst: svgToDataUri(buildMfirstSvg()),
    msecond: svgToDataUri(buildMsecondSvg()),
  };
  return _iconUris;
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
// Data extraction
// ============================================================

function queueToGpvKey(queue: string): string {
  return `GPV${queue}`;
}

/** Format unix timestamp to full Ukrainian date: "27 березня" */
function formatDayLabel(unixTs: number): string {
  const date = new Date(unixTs * 1000);
  return date.toLocaleDateString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "numeric",
    month: "long",
  });
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

  const timestamps = Object.keys(factDataMap)
    .map(Number)
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  const todayTs = timestamps[0] ?? 0;
  const tomorrowTs = timestamps[1] ?? 0;

  const todayResult = extractDayCells(factDataMap[String(todayTs)], gpvKey);
  const tomorrowResult = extractDayCells(factDataMap[String(tomorrowTs)], gpvKey);

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
// Cell styling
// ============================================================

export function getCellStyle(state: CellState): { bg: string; iconSrc: string | null } {
  const icons = getIconUris();
  switch (state) {
    case "yes":
      return { bg: "#ffffff", iconSrc: null };
    case "no":
      return { bg: "#ffffff", iconSrc: icons.no };
    case "maybe":
      return { bg: "#ffffff", iconSrc: icons.maybe };
    case "mfirst":
      return { bg: "#ffffff", iconSrc: icons.mfirst };
    case "msecond":
      return { bg: "#ffffff", iconSrc: icons.msecond };
  }
}

// ============================================================
// Layout constants
// ============================================================

const CELL_W = 48;
const CELL_H = 44;
const HEADER_H = 80;
const LABEL_W = 100;
const PADDING = 24;
const TABLE_W = LABEL_W + CELL_W * 24;
const IMG_W = TABLE_W + PADDING * 2;
const ICON_SIZE = 18;

// ============================================================
// Layout builder — reference 1 style with reference 3 header
// ============================================================

function buildScheduleLayout(
  regionName: string,
  queue: string,
  updateDate: string,
  grid: ScheduleGrid,
): SatoriElement {
  // --- Header cell: diagonal text using positioned characters ---
  function headerCell(text: string): SatoriElement {
    const chars = text.split("");
    // Position each character diagonally: bottom-left → top-right
    const stepX = 7;
    const stepY = 14;
    const startX = 4;
    const startBottom = 4;

    return el("div", {
      display: "flex",
      position: "relative",
      width: CELL_W,
      height: HEADER_H,
      borderRight: "1px solid #e5e7eb",
      borderBottom: "1px solid #d1d5db",
      overflow: "hidden",
    },
      ...chars.map((ch, i) =>
        el("div", {
          display: "flex",
          position: "absolute",
          left: startX + i * stepX,
          bottom: startBottom + i * stepY,
          fontSize: 11,
          color: "#4b5563",
          lineHeight: 1,
        }, ch),
      ),
    );
  }

  // --- Data cell with optional icon ---
  function dataCell(state: CellState): SatoriElement {
    const { bg, iconSrc } = getCellStyle(state);
    const children: SatoriNode[] = [];
    if (iconSrc !== null) {
      children.push(img(iconSrc, ICON_SIZE, ICON_SIZE));
    }
    return el("div", {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: CELL_W,
      height: CELL_H,
      backgroundColor: bg,
      borderRight: "1px solid #e5e7eb",
      borderBottom: "1px solid #e5e7eb",
    }, ...children);
  }

  // --- Missing data row ---
  function missingRow(label: string): SatoriElement {
    return el("div", { display: "flex", flexDirection: "row", height: CELL_H },
      el("div", {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: LABEL_W,
        fontSize: 13,
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
        fontSize: 13,
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
        fontSize: 13,
        fontWeight: 700,
        color: "#374151",
        borderRight: "1px solid #d1d5db",
        borderBottom: "1px solid #e5e7eb",
      }, label),
      ...cells.map((s) => dataCell(s)),
    );
  }

  // --- Legend item with SVG icon ---
  function legendItem(iconUri: string | null, text: string, fallbackEl?: SatoriElement): SatoriElement {
    const iconNode: SatoriNode = iconUri !== null
      ? img(iconUri, 20, 20)
      : (fallbackEl ?? null);
    return el("div", {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
      iconNode,
      el("div", { display: "flex", fontSize: 12, color: "#4b5563" }, text),
    );
  }

  const icons = getIconUris();

  // "Світло є" legend icon: white square with thin border
  const lightOnIcon = el("div", {
    display: "flex",
    width: 20,
    height: 20,
    borderRadius: 2,
    border: "1px solid #d1d5db",
    backgroundColor: "#ffffff",
  });

  // --- Main layout ---
  return el("div", {
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
    padding: PADDING,
    paddingBottom: PADDING - 4,
    width: IMG_W,
    fontFamily: "Sans",
  },
    // Header row: update badge + region/queue badge
    el("div", {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
      // Left badge: "Оновлення від HH:MM DD.MM"
      el("div", {
        display: "flex",
        backgroundColor: "#f3f4f6",
        borderRadius: 6,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        fontSize: 13,
        color: "#6b7280",
        border: "1px solid #e5e7eb",
      }, `Оновлення від ${updateDate}`),
      // Right badge: "Регіон, Черга X.X"
      el("div", {
        display: "flex",
        backgroundColor: "#3b82f6",
        borderRadius: 8,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        fontSize: 15,
        fontWeight: 700,
        color: "#ffffff",
      }, `${regionName}, Черга ${queue}`),
    ),

    // Table
    el("div", {
      display: "flex",
      flexDirection: "column",
      border: "1px solid #d1d5db",
      borderRadius: 6,
      overflow: "hidden",
      marginBottom: 14,
    },
      // Header row with time slots
      el("div", { display: "flex", flexDirection: "row" },
        // "Часові проміжки" label
        el("div", {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: LABEL_W,
          height: HEADER_H,
          fontSize: 12,
          fontWeight: 700,
          color: "#4b5563",
          borderRight: "1px solid #d1d5db",
          borderBottom: "1px solid #d1d5db",
          textAlign: "center",
          lineHeight: 1.3,
        }, "Часові проміжки"),
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
      gap: 24,
      flexWrap: "wrap",
    },
      legendItem(null, "Світло є", lightOnIcon),
      legendItem(icons.no, "Світла нема"),
      legendItem(icons.mfirst, "Перші 30 хв."),
      legendItem(icons.msecond, "Другі 30 хв."),
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
