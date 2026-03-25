export interface TimerEvent {
  start: string; // "08:00"
  end: string; // "12:00"
}

export function formatTimerPopup(options: {
  hasPowerNow: boolean;
  nextEventTime: string | null; // "2г 15хв"
  currentPeriod: TimerEvent | null;
  noEventsToday: boolean;
  tomorrowInfo?: string | null;
}): string {
  if (options.noEventsToday) {
    let text = "🎉 Сьогодні без відключень!";
    if (options.tomorrowInfo != null && options.tomorrowInfo.length > 0) {
      text += `\n\n${options.tomorrowInfo}`;
    }
    return text;
  }

  if (options.hasPowerNow) {
    let text = "За графіком зараз:\n🟢 Світло зараз є";
    if (options.nextEventTime !== null && options.currentPeriod !== null) {
      text +=
        `\n\n⏳ Вимкнення через ${options.nextEventTime}` +
        `\n📅 Очікуємо - ${options.currentPeriod.start}–${options.currentPeriod.end}`;
    }
    return text;
  }

  let text = "За графіком зараз:\n🔴 Світла немає";
  if (options.nextEventTime !== null && options.currentPeriod !== null) {
    text +=
      `\n\n⏳ До увімкнення ${options.nextEventTime}` +
      `\n📅 Поточне - ${options.currentPeriod.start}–${options.currentPeriod.end}`;
  }
  return text;
}
