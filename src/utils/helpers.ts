import { createHash } from "node:crypto";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const IP_V4_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?::(\d{1,5}))?$/;

const DOMAIN_REGEX =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?::(\d{1,5}))?$/;

export function isValidIpOrDomain(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.length === 0) return false;

  const ipMatch = IP_V4_REGEX.exec(trimmed);
  if (ipMatch) {
    const port = ipMatch[1];
    if (port !== undefined) {
      const portNum = Number(port);
      return portNum >= 1 && portNum <= 65535;
    }
    return true;
  }

  const domainMatch = DOMAIN_REGEX.exec(trimmed);
  if (domainMatch) {
    const port = domainMatch[1];
    if (port !== undefined) {
      const portNum = Number(port);
      return portNum >= 1 && portNum <= 65535;
    }
    return true;
  }

  return false;
}

export function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function tgEmoji(emojiId: string, fallback: string): string {
  return `<tg-emoji emoji-id="${emojiId}">${fallback}</tg-emoji>`;
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours}г ${minutes}хв`;
  if (hours > 0) return `${hours}г`;
  return `${minutes}хв`;
}

export function formatDurationFromMs(ms: number): string {
  return formatDuration(Math.round(ms / 60_000));
}

const KYIV_TZ = "Europe/Kyiv";

export function nowKyiv(): Date {
  const str = new Date().toLocaleString("en-US", { timeZone: KYIV_TZ });
  return new Date(str);
}

export function formatDateKyiv(date: Date): string {
  return date.toLocaleDateString("uk-UA", {
    timeZone: KYIV_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatTimeKyiv(date: Date): string {
  return date.toLocaleTimeString("uk-UA", {
    timeZone: KYIV_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatTimeAgo(isoDate: string): string {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return "щойно";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "щойно";
  if (diffMin < 60) return `${diffMin} хв тому`;

  const diffHours = Math.floor(diffMin / 60);
  const remainMin = diffMin % 60;
  if (diffHours < 24) {
    return remainMin > 0 ? `${diffHours} год ${remainMin} хв тому` : `${diffHours} год тому`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} дн тому`;
}

const DAY_NAMES_UK = [
  "неділя",
  "понеділок",
  "вівторок",
  "середа",
  "четвер",
  "п'ятниця",
  "субота",
] as const;

export function getDayNameKyiv(date: Date): string {
  const kyivDate = new Date(date.toLocaleString("en-US", { timeZone: KYIV_TZ }));
  const dayIndex = kyivDate.getDay();
  return DAY_NAMES_UK[dayIndex] ?? "невідомо";
}
