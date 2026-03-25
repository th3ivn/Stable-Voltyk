import { EMOJI } from "../constants/emoji.js";
import { tgEmoji } from "../utils/helpers.js";

export interface ScheduleEvent {
  start: string; // "08:00"
  end: string; // "12:00"
  durationMinutes: number;
  isPossible: boolean; // ⚠️ можливе
  isNew: boolean; // 🆕 нове
}

export function formatScheduleMessage(options: {
  queue: string;
  date: string; // "25.03.2026"
  dayName: string; // "середа"
  events: ScheduleEvent[];
  totalMinutesOff: number;
}): string {
  if (options.events.length === 0) {
    return (
      `<i>💡 Графік відключень <b>на сьогодні, ${options.date} (${options.dayName}),</b> ` +
      `для черги ${options.queue}:</i>\n\n` +
      `${tgEmoji(EMOJI.CHECK, "✅")} Відключень не заплановано`
    );
  }

  let text =
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

    text += `🪫 <b>${event.start} - ${event.end} (~${durationStr})</b>`;
    if (flags.length > 0) text += ` ${flags}`;
    text += "\n";
  }

  const totalStr = formatEventDuration(options.totalMinutesOff);
  text += `Загалом без світла:<b> ~${totalStr}</b>`;

  return text;
}

function formatEventDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}г ${m}хв`;
  if (h > 0) return `${h}г`;
  return `${m}хв`;
}
