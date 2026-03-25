import type { Bot } from "grammy";
import type { BotContext } from "../bot.js";
import { showMainMenu } from "./start.js";
import { findUserByTelegramId, findUserWithRelations } from "../db/queries/users.js";
import { getOutagesForWeek } from "../db/queries/power.js";
import {
  scheduleKeyboard,
  helpKeyboard,
  instructionMenuKeyboard,
  instructionBackKeyboard,
  faqKeyboard,
  supportKeyboard,
  statsKeyboard,
  statsBackKeyboard,
  backToMainKeyboard,
} from "../keyboards/inline.js";
import {
  helpMessage,
  faqMessage,
  supportMessage,
  statsMessage,
  statsWeekMessage,
  formatLiveStatusMessage,
} from "../formatters/messages.js";
import { formatTimerPopup, type TimerEvent } from "../formatters/timer.js";
import { EMOJI } from "../constants/emoji.js";
import { tgEmoji } from "../utils/helpers.js";
import { config } from "../config.js";

export function registerMenuHandlers(bot: Bot<BotContext>): void {
  // Back to main menu
  bot.callbackQuery("back_to_main", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    await showMainMenu(ctx, user.id);
  });

  // ============================================================
  // Schedule
  // ============================================================
  bot.callbackQuery("menu_schedule", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    // For now show a placeholder — full schedule with image will be in Step 11 (API Service)
    const text =
      `<i>💡 Графік відключень для черги ${user.queue}:</i>\n\n` +
      `⏳ Завантаження даних графіку...\n\n` +
      `<i>Графік буде доступний після підключення API сервісу.</i>`;

    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: scheduleKeyboard(),
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: scheduleKeyboard(),
      });
    }
  });

  // Schedule check (refresh)
  bot.callbackQuery("schedule_check", async (ctx) => {
    await ctx.answerCallbackQuery({
      text: "⏳ Перевірка оновлень буде доступна після підключення API сервісу.",
      show_alert: false,
    });
  });

  // Queue change from schedule view
  bot.callbackQuery("my_queues", async (ctx) => {
    await ctx.answerCallbackQuery();
    // Will redirect to settings_region in Step 8
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;
    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;
    await showMainMenu(ctx, user.id);
  });

  // ============================================================
  // Timer (popup)
  // ============================================================
  bot.callbackQuery("menu_timer", async (ctx) => {
    // Timer is always a popup (show_alert: true)
    // For now, show placeholder — full timer with schedule data in Step 11
    const text = formatTimerPopup({
      hasPowerNow: true,
      nextEventTime: null,
      currentPeriod: null,
      noEventsToday: true,
    });

    await ctx.answerCallbackQuery({
      text,
      show_alert: true,
    });
  });

  // ============================================================
  // Stats
  // ============================================================
  bot.callbackQuery("menu_stats", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(statsMessage(), {
      reply_markup: statsKeyboard(),
    });
  });

  bot.callbackQuery("stats_week", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    const outages = await getOutagesForWeek(ctx.db, user.id);
    const totalMinutes = outages.reduce((sum, o) => sum + (o.durationMinutes ?? 0), 0);

    await ctx.editMessageText(
      statsWeekMessage({ outageCount: outages.length, totalMinutes }),
      { reply_markup: statsBackKeyboard() },
    );
  });

  bot.callbackQuery("stats_device", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    let text: string;
    if (data.user.routerIp != null) {
      const state = data.powerTracking?.powerState ?? "невідомо";
      const stateEmoji = state === "online" ? "🟢" : state === "offline" ? "🔴" : "❓";
      text = `📡 Статус пристрою\n\nIP: ${data.user.routerIp}\nСтатус: ${stateEmoji} ${state}`;
    } else {
      text = `📡 Статус пристрою\n\nIP-адресу не налаштовано.\nДодайте IP в налаштуваннях для моніторингу.`;
    }

    await ctx.editMessageText(text, { reply_markup: statsBackKeyboard() });
  });

  bot.callbackQuery("stats_my_settings", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const data = await findUserWithRelations(ctx.db, telegramId);
    if (data === null) return;

    const hasChannel =
      data.channelConfig?.channelId != null && data.channelConfig.channelId.length > 0;
    const hasNotifications = data.notificationSettings?.notifyScheduleChanges ?? false;

    const text = formatLiveStatusMessage({
      region: data.user.region,
      queue: data.user.queue,
      routerIp: data.user.routerIp,
      hasChannel,
      channelTitle: data.channelConfig?.channelTitle,
      hasNotifications,
    });

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: statsBackKeyboard(),
    });
  });

  // ============================================================
  // Help
  // ============================================================
  bot.callbackQuery("menu_help", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(helpMessage(), {
      reply_markup: helpKeyboard(
        "https://t.me/Voltyk_news",
        config.SUPPORT_CHANNEL_URL,
      ),
    });
  });

  // Instruction menu
  bot.callbackQuery("help_instruction", async (ctx) => {
    await ctx.answerCallbackQuery();
    const text =
      `${tgEmoji(EMOJI.INSTRUCTION, "📖")} Інструкція\n\n` +
      `Оберіть розділ, щоб дізнатися більше:`;
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: instructionMenuKeyboard(),
    });
  });

  // Instruction sections
  registerInstructionHandlers(bot);

  // FAQ
  bot.callbackQuery("help_faq", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(faqMessage(), {
      parse_mode: "HTML",
      reply_markup: faqKeyboard(),
    });
  });

  // Support
  bot.callbackQuery("help_support", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(supportMessage(), {
      parse_mode: "HTML",
      reply_markup: supportKeyboard(config.SUPPORT_CHANNEL_URL),
    });
  });

  // ============================================================
  // Reminder (from notifications)
  // ============================================================
  bot.callbackQuery("reminder_dismiss", async (ctx) => {
    await ctx.answerCallbackQuery("👌");
    try {
      await ctx.deleteMessage();
    } catch {
      // ignore if already deleted
    }
  });

  bot.callbackQuery("reminder_show_schedule", async (ctx) => {
    await ctx.answerCallbackQuery();
    const telegramId = ctx.from?.id.toString();
    if (telegramId === undefined) return;

    const user = await findUserByTelegramId(ctx.db, telegramId);
    if (user === null) return;

    // Redirect to schedule view
    const text =
      `<i>💡 Графік відключень для черги ${user.queue}:</i>\n\n` +
      `⏳ Завантаження даних графіку...`;

    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: scheduleKeyboard(),
    });
  });
}

// ============================================================
// Instruction section handlers
// ============================================================
function registerInstructionHandlers(bot: Bot<BotContext>): void {
  const sections: Record<string, string> = {
    instr_region:
      `${tgEmoji(EMOJI.REGION, "📍")} <b>Регіон і черга</b>\n\n` +
      `Регіон та черга — це основні параметри, за якими бот визначає ваш графік відключень.\n\n` +
      `<b>Як обрати чергу?</b>\n` +
      `Чергу можна дізнатися у вашого обленерго або на їхньому сайті. ` +
      `Зазвичай це вказано в рахунку за електроенергію.\n\n` +
      `Змінити регіон або чергу можна в меню <b>Налаштування → Регіон</b>.`,

    instr_notif:
      `${tgEmoji(EMOJI.NOTIF_SECTION, "🔔")} <b>Сповіщення</b>\n\n` +
      `Бот може надсилати сповіщення про:\n\n` +
      `• <b>Оновлення графіків</b> — коли обленерго змінює графік\n` +
      `• <b>Нагадування</b> — за 15хв/30хв/1год до відключення або увімкнення\n` +
      `• <b>Фактичні зміни</b> — коли світло реально зникає/з'являється (потрібен IP)\n\n` +
      `Налаштувати можна в меню <b>Сповіщення</b>.`,

    instr_channel:
      `${tgEmoji(EMOJI.CHANNEL_SECTION, "📺")} <b>Канал</b>\n\n` +
      `Ви можете підключити свій Telegram-канал, і бот буде автоматично ` +
      `публікувати графіки та сповіщення туди.\n\n` +
      `<b>Як підключити:</b>\n` +
      `1. Додайте бота як адміністратора каналу\n` +
      `2. Увімкніть всі права\n` +
      `3. Бот знайде канал автоматично\n\n` +
      `Налаштувати можна в меню <b>Канал</b>.`,

    instr_ip:
      `${tgEmoji(EMOJI.IP_SECTION, "📡")} <b>IP моніторинг</b>\n\n` +
      `Бот може перевіряти наявність світла у вас вдома, пінгуючи ваш роутер.\n\n` +
      `<b>Що потрібно:</b>\n` +
      `• Статична (біла) IP-адреса, або\n` +
      `• DDNS (якщо немає статичного IP)\n\n` +
      `Коли роутер не відповідає — значить світла немає, і бот надішле сповіщення.\n\n` +
      `Налаштувати можна в меню <b>Налаштування → IP</b>.`,

    instr_schedule:
      `${tgEmoji(EMOJI.SCHEDULE_SEC, "📊")} <b>Графік відключень</b>\n\n` +
      `Бот показує графік відключень для вашої черги на сьогодні та завтра.\n\n` +
      `• Дані оновлюються автоматично\n` +
      `• Можна перевірити вручну кнопкою "Перевірити"\n` +
      `• Графік відображається як зображення та текст\n\n` +
      `Переглянути можна в головному меню → <b>Графік</b>.`,

    instr_bot_settings:
      `${tgEmoji(EMOJI.BOT_SETTINGS, "⚙️")} <b>Налаштування бота</b>\n\n` +
      `В налаштуваннях можна:\n\n` +
      `• Змінити регіон та чергу\n` +
      `• Налаштувати IP моніторинг\n` +
      `• Підключити/відключити канал\n` +
      `• Керувати сповіщеннями\n` +
      `• Увімкнути автоочищення повідомлень\n` +
      `• Видалити свої дані\n\n` +
      `Все це доступно в головному меню → <b>Налаштування</b>.`,
  };

  for (const [callbackData, text] of Object.entries(sections)) {
    bot.callbackQuery(callbackData, async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: instructionBackKeyboard(),
      });
    });
  }
}
