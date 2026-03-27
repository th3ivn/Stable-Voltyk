import type { MessageEntity } from "@grammyjs/types";
import { EMOJI } from "../constants/emoji.js";
import { tgEmoji } from "../utils/helpers.js";
import { htmlToEntities } from "../utils/html-to-entities.js";

export interface ScheduleEvent {
  start: string; // "08:00"
  end: string; // "12:00"
  durationMinutes: number;
  isPossible: boolean; // ⚠️ можливе
  isNew: boolean; // 🆕 нове
}

export interface ScheduleMessageResult {
  text: string;
  entities: MessageEntity[];
}

/**
 * Format schedule message and return plain text + entities.
 * Uses htmlToEntities to convert HTML formatting to MessageEntity[],
 * then appends a date_time entity for auto-updating "Оновлено: X тому".
 */
export function formatScheduleMessage(options: {
  queue: string;
  date: string; // "25.03.2026"
  dayName: string; // "середа"
  events: ScheduleEvent[];
  totalMinutesOff: number;
  lastUpdatedUnix?: number | null;
}): ScheduleMessageResult {
  // Build HTML version first
  let html: string;

  if (options.events.length === 0) {
    html =
      `<i>💡 Графік відключень <b>на сьогодні, ${options.date} (${options.dayName}),</b> ` +
      `для черги ${options.queue}:</i>\n\n` +
      `${tgEmoji(EMOJI.CHECK, "✅")} Відключень не заплановано`;
  } else {
    html =
      `<i>💡 Графік відключень <b>на сьогодні, ${options.date} (${options.dayName}),</b> ` +
      `для черги ${options.queue}:</i>\n\n`;

    for (const event of options.events) {
      const durationStr = formatEventDuration(event.durationMinutes);
      const flags = [
        event.isPossible ? "⚠️" : "",
        event.isNew ? "🆕" : "",
      ]
        .filter((f) => f.length > 0)
        .join(" ");

      html += `🪫 <b>${event.start} - ${event.end} (~${durationStr})</b>`;
      if (flags.length > 0) html += ` ${flags}`;
      html += "\n";
    }

    const totalStr = formatEventDuration(options.totalMinutesOff);
    html += `Загалом без світла:<b> ~${totalStr}</b>`;
  }

  // Convert HTML to plain text + entities
  const { text: baseText, entities } = htmlToEntities(html);

  // Append date_time line if we have lastUpdatedUnix
  if (options.lastUpdatedUnix != null && options.lastUpdatedUnix > 0) {
    const PLACEHOLDER = "оновлено";
    const updatedPrefix = "\n\n🕐 Оновлено: ";
    const fullText = baseText + updatedPrefix + PLACEHOLDER;

    // Calculate offset of the placeholder in UTF-16 code units
    const placeholderOffset = (baseText + updatedPrefix).length;

    const dateTimeEntity: MessageEntity.DateTimeMessageEntity = {
      type: "date_time",
      offset: placeholderOffset,
      length: PLACEHOLDER.length,
      unix_time: options.lastUpdatedUnix,
      date_time_format: "r",
    };

    return {
      text: fullText,
      entities: [...entities, dateTimeEntity],
    };
  }

  return { text: baseText, entities };
}

function formatEventDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}г ${m}хв`;
  if (h > 0) return `${h}г`;
  return `${m}хв`;
}
