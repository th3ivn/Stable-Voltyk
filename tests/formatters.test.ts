import { describe, it, expect } from "vitest";
import {
  formatMainMenuMessage,
  wizardStep1Message,
  wizardDoneMessage,
  deleteDataDoneMessage,
  statsWeekMessage,
  buildNotificationSettingsMessage,
} from "../src/formatters/messages.js";
import { formatScheduleMessage } from "../src/formatters/schedule.js";
import { formatTimerPopup } from "../src/formatters/timer.js";

describe("formatMainMenuMessage", () => {
  it("formats menu with channel connected", () => {
    const result = formatMainMenuMessage({
      region: "kyiv",
      queue: "1.1",
      hasChannel: true,
      channelTitle: "My Channel",
      hasNotifications: true,
    });
    expect(result).toContain("Київ • 1.1");
    expect(result).toContain("підключено ✅");
    expect(result).toContain("увімкнено ✅");
  });

  it("formats menu without channel", () => {
    const result = formatMainMenuMessage({
      region: "odesa",
      queue: "2.1",
      hasChannel: false,
      hasNotifications: false,
    });
    expect(result).toContain("Одещина • 2.1");
    expect(result).toContain("не підключено");
    expect(result).toContain("вимкнено");
  });
});

describe("formatScheduleMessage", () => {
  it("formats events list", () => {
    const result = formatScheduleMessage({
      queue: "1.1",
      date: "25.03.2026",
      dayName: "середа",
      events: [
        { start: "08:00", end: "12:00", durationMinutes: 240, isPossible: false, isNew: false },
        { start: "16:00", end: "20:00", durationMinutes: 240, isPossible: true, isNew: true },
      ],
      totalMinutesOff: 480,
    });
    expect(result).toContain("для черги 1.1");
    expect(result).toContain("08:00 - 12:00 (~4г)");
    expect(result).toContain("16:00 - 20:00 (~4г)");
    expect(result).toContain("⚠️");
    expect(result).toContain("🆕");
    expect(result).toContain("~8г");
  });

  it("formats no events", () => {
    const result = formatScheduleMessage({
      queue: "2.2",
      date: "25.03.2026",
      dayName: "середа",
      events: [],
      totalMinutesOff: 0,
    });
    expect(result).toContain("Відключень не заплановано");
  });
});

describe("formatTimerPopup", () => {
  it("shows no events today", () => {
    const result = formatTimerPopup({
      hasPowerNow: true,
      nextEventTime: null,
      currentPeriod: null,
      noEventsToday: true,
    });
    expect(result).toContain("Сьогодні без відключень!");
  });

  it("shows power on with next event", () => {
    const result = formatTimerPopup({
      hasPowerNow: true,
      nextEventTime: "2г 15хв",
      currentPeriod: { start: "14:00", end: "18:00" },
      noEventsToday: false,
    });
    expect(result).toContain("🟢 Світло зараз є");
    expect(result).toContain("Вимкнення через 2г 15хв");
    expect(result).toContain("14:00–18:00");
  });

  it("shows power off with next event", () => {
    const result = formatTimerPopup({
      hasPowerNow: false,
      nextEventTime: "1г 30хв",
      currentPeriod: { start: "08:00", end: "12:00" },
      noEventsToday: false,
    });
    expect(result).toContain("🔴 Світла немає");
    expect(result).toContain("До увімкнення 1г 30хв");
  });
});

describe("wizardMessages", () => {
  it("step1 contains greeting", () => {
    expect(wizardStep1Message()).toContain("Вітаю! Я Вольтик");
  });

  it("done contains region and queue", () => {
    const result = wizardDoneMessage({ region: "dnipro", queue: "3.1" });
    expect(result).toContain("Дніпропетровщина");
    expect(result).toContain("3.1");
    expect(result).toContain("Готово!");
  });
});

describe("statsWeekMessage", () => {
  it("shows no outages", () => {
    const result = statsWeekMessage({ outageCount: 0, totalMinutes: 0 });
    expect(result).toContain("відключень не зафіксовано");
  });

  it("shows outage stats", () => {
    const result = statsWeekMessage({ outageCount: 3, totalMinutes: 150 });
    expect(result).toContain("3");
    expect(result).toContain("2г 30хв");
  });
});

describe("buildNotificationSettingsMessage", () => {
  it("shows all settings", () => {
    const result = buildNotificationSettingsMessage({
      scheduleChanges: true,
      remind1h: false,
      remind30m: false,
      remind15m: true,
      factOff: true,
      factOn: false,
      remindOff: true,
      remindOn: true,
    });
    expect(result).toContain("Керування сповіщеннями");
    expect(result).toContain("Оновлення графіків — ✅");
    expect(result).toContain("За 1 год — ❌");
    expect(result).toContain("За 15 хв — ✅");
  });
});

describe("deleteDataDoneMessage", () => {
  it("contains /start reference", () => {
    expect(deleteDataDoneMessage()).toContain("/start");
  });
});
