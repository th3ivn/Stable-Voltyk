import { EMOJI } from "../constants/emoji.js";
import { getRegionName } from "../constants/regions.js";
import { tgEmoji } from "../utils/helpers.js";

// ============================================================
// Main menu message
// ============================================================
export function formatMainMenuMessage(options: {
  region: string;
  queue: string;
  hasChannel: boolean;
  channelTitle?: string | null;
  hasNotifications: boolean;
}): string {
  const regionName = getRegionName(options.region);
  const channelStatus =
    options.hasChannel && options.channelTitle != null
      ? `підключено ✅`
      : "не підключено";
  const notifStatus = options.hasNotifications ? "увімкнено ✅" : "вимкнено";

  return (
    `🏠 Головне меню\n\n` +
    `📍 Регіон: ${regionName} • ${options.queue}\n` +
    `📺 Канал: ${channelStatus}\n` +
    `🔔 Сповіщення: ${notifStatus}`
  );
}

// ============================================================
// Settings / Live status message
// ============================================================
export function formatLiveStatusMessage(options: {
  region: string;
  queue: string;
  routerIp: string | null;
  hasChannel: boolean;
  channelTitle?: string | null;
  hasNotifications: boolean;
  ipOnline?: boolean | null;
}): string {
  const regionName = getRegionName(options.region);
  const ipStatus =
    options.routerIp != null
      ? `підключено ✅`
      : "не підключено 😕";
  const channelStatus =
    options.hasChannel && options.channelTitle != null
      ? `підключено ✅`
      : "не підключено";
  const notifStatus = options.hasNotifications ? "увімкнено ✅" : "вимкнено";

  let text =
    `📍 <b>${regionName} · ${options.queue}</b>\n\n` +
    `📡 IP: ${ipStatus}\n` +
    `📺 Канал: ${channelStatus}\n` +
    `🔔 Сповіщення: ${notifStatus}\n`;

  if (options.routerIp == null) {
    text += "\n💡 Додайте IP для моніторингу світла";
  } else if (options.hasNotifications) {
    text += "\n✅ Моніторинг активний";
  }

  return text;
}

// ============================================================
// Notification settings message
// ============================================================
export function buildNotificationSettingsMessage(settings: {
  scheduleChanges: boolean;
  remind1h: boolean;
  remind30m: boolean;
  remind15m: boolean;
  factOff: boolean;
  factOn: boolean;
  remindOff: boolean;
  remindOn: boolean;
}): string {
  const on = "✅";
  const off = "❌";

  return (
    `${tgEmoji(EMOJI.BELL, "🔔")} Керування сповіщеннями\n\n` +
    `${tgEmoji(EMOJI.SCHEDULE_CHANGES, "📈")} Оновлення графіків — ${settings.scheduleChanges ? on : off}\n\n` +
    `${tgEmoji(EMOJI.HOURGLASS, "⏳")} Нагадування про події перед (вимкнення / відновлення):\n` +
    `├ За 1 год — ${settings.remind1h ? on : off}\n` +
    `├ За 30 хв — ${settings.remind30m ? on : off}\n` +
    `├ За 15 хв — ${settings.remind15m ? on : off}\n` +
    `└ Фактично за IP-адресою — ${settings.factOff ? on : off}\n\n` +
    `<i>Нагадування перед відкл. — ${settings.remindOff ? on : off} · перед вкл. — ${settings.remindOn ? on : off}</i>`
  );
}

// ============================================================
// Wizard messages
// ============================================================
export function wizardStep1Message(): string {
  return (
    `👋 Вітаю! Я Вольтик ⚡\n\n` +
    `Слідкую за відключеннями світла і одразу\n` +
    `повідомлю, як тільки щось зміниться.\n\n` +
    `Налаштування займе ~1 хвилину.\n\n` +
    `📍 Крок 1 із 3 — Оберіть свій регіон:`
  );
}

export function wizardStep2Message(regionName: string): string {
  return (
    `✅ Регіон: ${regionName}\n\n` +
    `⚡ Крок 2 із 3 — Оберіть свою чергу:`
  );
}

export function wizardStep3Message(queue: string): string {
  return (
    `✅ Черга: ${queue}\n\n` +
    `📬 Крок 3 із 3 — Куди надсилати сповіщення?\n\n` +
    `📱 У цьому боті\n` +
    `Сповіщення приходитимуть прямо в цей чат\n\n` +
    `📺 У Telegram-каналі\n` +
    `Бот публікуватиме у ваш канал\n` +
    `(потрібно додати бота як адміністратора)`
  );
}

export function wizardNotifSettingsMessage(): string {
  return `🔔 Налаштуйте сповіщення в боті:`;
}

export function wizardDoneMessage(options: {
  region: string;
  queue: string;
}): string {
  const regionName = getRegionName(options.region);
  return (
    `✅ Готово!\n\n` +
    `📍 Регіон: ${regionName}\n` +
    `⚡ Черга: ${options.queue}\n` +
    `🔔 Сповіщення: увімкнено ✅\n\n` +
    `Я одразу повідомлю вас про наступне\n` +
    `відключення або появу світла.\n\n` +
    `⤵ Меню — перейти в головне меню\n` +
    `📢 Новини бота — канал з оновленнями`
  );
}

// ============================================================
// Deactivated user
// ============================================================
export function deactivatedUserMessage(): string {
  return (
    `👋 З поверненням!\n\n` +
    `Ваш профіль було деактивовано.\n\n` +
    `Оберіть опцію:`
  );
}

// ============================================================
// Registration disabled
// ============================================================
export function registrationDisabledMessage(): string {
  return (
    `⚠️ Реєстрація тимчасово обмежена\n\n` +
    `На даний момент реєстрація нових користувачів тимчасово зупинена.\n\n` +
    `Спробуйте пізніше або зв'яжіться з підтримкою.`
  );
}

// ============================================================
// Help
// ============================================================
export function helpMessage(): string {
  return (
    `❓ Допомога\n\n` +
    `Тут ви можете дізнатися як користуватися\n` +
    `ботом або звернутися за підтримкою.`
  );
}

export function faqMessage(): string {
  return (
    `${tgEmoji(EMOJI.FAQ, "❓")} FAQ\n\n` +
    `Тут ви знайдете відповіді на найпоширеніші\n` +
    `питання про роботу бота.`
  );
}

export function supportMessage(): string {
  return (
    `${tgEmoji(EMOJI.SUPPORT, "💬")} Служба підтримки\n\n` +
    `Натисніть кнопку нижче щоб написати\n` +
    `адміністратору напряму в Telegram.\n` +
    `Відповідь надійде найближчим часом.`
  );
}

// ============================================================
// IP monitoring messages
// ============================================================
export function ipNoIpMessage(): string {
  return (
    `${tgEmoji(EMOJI.IP_SETTINGS, "⚙️")} Налаштування моніторингу світла\n\n` +
    `Бот визначає статус світла у вас вдома — пінгуючи ваш роутер.\n\n` +
    `Варіант 1 — Статична (біла) IP-адреса\n` +
    `Дізнатися свою IP можна у провайдера або на 2ip.ua\n\n` +
    `Варіант 2 — DDNS (якщо немає статичного IP)\n` +
    `Налаштуйте DDNS на роутері (наприклад, noip.com)\n\n` +
    `Приклади вводу:\n` +
    `192.168.1.1\n` +
    `192.168.1.1:80\n` +
    `myhome.ddns.net\n\n` +
    `Введіть вашу IP-адресу або DDNS:`
  );
}

export function ipWithIpMessage(routerIp: string, status: string): string {
  return (
    `${tgEmoji(EMOJI.IP_SETTINGS, "⚙️")} IP моніторинг\n\n` +
    `${tgEmoji(EMOJI.IP_ADDR, "📡")} IP: ${routerIp}\n` +
    `Статус: ${status}`
  );
}

export function ipStatusOnline(): string {
  return `${tgEmoji(EMOJI.ONLINE, "🟢")} Онлайн`;
}

export function ipStatusOffline(): string {
  return `${tgEmoji(EMOJI.OFFLINE, "🔴")} Офлайн`;
}

export function ipStatusChecking(): string {
  return `Перевіряю ${tgEmoji(EMOJI.PING_LOADING, "⏳")}`;
}

// ============================================================
// Cleanup
// ============================================================
export function cleanupMessage(options: {
  autoDeleteCommands: boolean;
  autoDeleteBotMessages: boolean;
}): string {
  const cmdStatus = options.autoDeleteCommands ? "увімкнено ✅" : "вимкнено";
  const msgStatus = options.autoDeleteBotMessages ? "увімкнено ✅" : "вимкнено";
  return (
    `🗑 Автоматичне очищення\n\n` +
    `⌨️ Команди: ${cmdStatus}\n` +
    `💬 Відповіді: ${msgStatus}`
  );
}

// ============================================================
// Delete data
// ============================================================
export function deleteDataStep1Message(): string {
  return (
    `⚠️ Увага\n\n` +
    `Видалити всі дані:\n` +
    `• Профіль та налаштування\n` +
    `• Канал та його налаштування\n` +
    `• Історію та статистику\n` +
    `• Сповіщення\n\n` +
    `Цю дію неможливо скасувати.`
  );
}

export function deleteDataStep2Message(): string {
  return `❗ Підтвердження\n\nВидалити всі дані? Цю дію неможливо скасувати.`;
}

export function deleteDataDoneMessage(): string {
  return `Добре, домовились 🙂 Я видалив усі дані та відключив канал.\n\nЯкщо захочете повернутися — /start`;
}

// ============================================================
// Channel
// ============================================================
export function channelSettingsMessage(options: {
  hasChannel: boolean;
  channelTitle?: string | null;
}): string {
  if (options.hasChannel && options.channelTitle != null) {
    return `📺 Налаштування каналу\n📺 Канал: ${options.channelTitle} ✅`;
  }
  return `📺 Налаштування каналу`;
}

export function channelConnectInstructionMessage(botUsername: string): string {
  return (
    `📺 <b>Підключення каналу</b>\n\n` +
    `Щоб бот міг публікувати графіки у ваш канал:\n\n` +
    `1️⃣ Відкрийте ваш канал у Telegram\n` +
    `2️⃣ Перейдіть у Налаштування → Адміністратори\n` +
    `3️⃣ Натисніть "Додати адміністратора"\n` +
    `4️⃣ Знайдіть бота: @${botUsername}\n` +
    `5️⃣ Увімкніть усі перемикачі\n\n` +
    `Після того як ви додасте бота — він знайде канал автоматично.`
  );
}

// ============================================================
// Stats
// ============================================================
export function statsMessage(): string {
  return `📊 Статистика`;
}

// ============================================================
// Channel info
// ============================================================
export function channelInfoMessage(options: {
  channelId: string;
  channelTitle?: string | null;
  channelDescription?: string | null;
  channelStatus: string;
  channelPaused: boolean;
}): string {
  const status = options.channelPaused
    ? "⏸ На паузі"
    : options.channelStatus === "active"
      ? "🟢 Активний"
      : "🔴 Відключено";

  const text =
    `📺 <b>Інформація про канал</b>\n\n` +
    `🆔 ID: <code>${options.channelId}</code>\n` +
    `📝 Назва: ${options.channelTitle ?? "—"}\n` +
    `📄 Опис: ${options.channelDescription ?? "—"}\n` +
    `📊 Статус: ${status}`;

  return text;
}

// ============================================================
// Channel format
// ============================================================
export function channelFormatMessage(options: {
  pictureOnly: boolean;
  deleteOldMessage: boolean;
}): string {
  const on = "✅";
  const off = "❌";
  return (
    `📋 <b>Формат публікацій</b>\n\n` +
    `🖼 Тільки зображення: ${options.pictureOnly ? on : off}\n` +
    `🗑 Видаляти старе повідомлення: ${options.deleteOldMessage ? on : off}\n\n` +
    `<i>Тільки зображення — бот публікуватиме лише фото графіку без тексту.\n` +
    `Видаляти старе — при оновленні графіку старе повідомлення буде видалено.</i>`
  );
}

// ============================================================
// Channel notifications
// ============================================================
export function channelNotificationsMessage(settings: {
  chNotifySchedule: boolean;
  chRemind1h: boolean;
  chRemind30m: boolean;
  chRemind15m: boolean;
  chNotifyFactOff: boolean;
  chNotifyFactOn: boolean;
  chNotifyRemindOff: boolean;
  chNotifyRemindOn: boolean;
}): string {
  const on = "✅";
  const off = "❌";

  return (
    `${tgEmoji(EMOJI.BELL, "🔔")} Сповіщення каналу\n\n` +
    `${tgEmoji(EMOJI.SCHEDULE_CHANGES, "📈")} Оновлення графіків — ${settings.chNotifySchedule ? on : off}\n\n` +
    `${tgEmoji(EMOJI.HOURGLASS, "⏳")} Нагадування про події:\n` +
    `├ За 1 год — ${settings.chRemind1h ? on : off}\n` +
    `├ За 30 хв — ${settings.chRemind30m ? on : off}\n` +
    `├ За 15 хв — ${settings.chRemind15m ? on : off}\n` +
    `└ Фактично за IP-адресою — ${settings.chNotifyFactOff ? on : off}\n\n` +
    `<i>Нагадування перед відкл. — ${settings.chNotifyRemindOff ? on : off} · перед вкл. — ${settings.chNotifyRemindOn ? on : off}</i>`
  );
}

// ============================================================
// Channel edit prompts
// ============================================================
export function channelEditTitleMessage(currentTitle?: string | null): string {
  const current = currentTitle != null ? `Поточна назва: ${currentTitle}\n\n` : "";
  return `✏️ <b>Назва каналу</b>\n\n${current}Введіть нову назву для каналу:`;
}

export function channelEditDescMessage(currentDesc?: string | null): string {
  const current = currentDesc != null ? `Поточний опис: ${currentDesc}\n\n` : "";
  return `📝 <b>Опис каналу</b>\n\n${current}Введіть новий опис для каналу:`;
}

// ============================================================
// Channel test
// ============================================================
export function channelTestSentMessage(channelTitle: string): string {
  return `🧪 Тестове повідомлення надіслано в канал "${channelTitle}"`;
}

// ============================================================
// Pending channel
// ============================================================
export function pendingChannelMessage(channelTitle: string): string {
  return (
    `📺 <b>Знайдено канал!</b>\n\n` +
    `Канал: <b>${channelTitle}</b>\n\n` +
    `Підключити цей канал до бота?`
  );
}

// ============================================================
// Stats
// ============================================================
export function statsWeekMessage(options: {
  outageCount: number;
  totalMinutes: number;
}): string {
  if (options.outageCount === 0) {
    return (
      `⚡ Відключення за тиждень\n\n` +
      `За останні 7 днів відключень не зафіксовано.`
    );
  }

  const hours = Math.floor(options.totalMinutes / 60);
  const minutes = options.totalMinutes % 60;
  const duration =
    hours > 0 && minutes > 0
      ? `${hours}г ${minutes}хв`
      : hours > 0
        ? `${hours}г`
        : `${minutes}хв`;

  return (
    `⚡ Відключення за тиждень\n\n` +
    `📊 Кількість відключень: ${options.outageCount}\n` +
    `⏱ Загальний час без світла: ${duration}`
  );
}

// ============================================================
// Admin messages
// ============================================================
export function adminPanelMessage(): string {
  return `👑 <b>Адмін-панель</b>\n\nОберіть розділ:`;
}

export function adminAnalyticsMessage(options: {
  totalUsers: number;
  activeUsers: number;
  usersWithIp: number;
  usersWithChannel: number;
}): string {
  return (
    `📊 <b>Аналітика</b>\n\n` +
    `👥 Всього користувачів: ${options.totalUsers}\n` +
    `✅ Активних: ${options.activeUsers}\n` +
    `📡 З IP моніторингом: ${options.usersWithIp}\n` +
    `📺 З каналом: ${options.usersWithChannel}`
  );
}

export function adminUsersStatsMessage(options: {
  totalUsers: number;
  activeUsers: number;
  blockedUsers: number;
  regionBreakdown: Array<{ region: string; count: number }>;
}): string {
  let text =
    `👥 <b>Статистика користувачів</b>\n\n` +
    `📊 Всього: ${options.totalUsers}\n` +
    `✅ Активних: ${options.activeUsers}\n` +
    `🚫 Заблокованих: ${options.blockedUsers}\n`;

  if (options.regionBreakdown.length > 0) {
    text += `\n📍 <b>По регіонах:</b>\n`;
    for (const { region, count } of options.regionBreakdown) {
      text += `  • ${region}: ${count}\n`;
    }
  }

  return text;
}

export function adminBroadcastPromptMessage(): string {
  return `📢 <b>Розсилка</b>\n\nВведіть текст повідомлення для всіх активних користувачів:`;
}

export function adminBroadcastPreviewMessage(text: string, userCount: number): string {
  return (
    `📢 <b>Попередній перегляд</b>\n\n` +
    `${text}\n\n` +
    `<i>Буде надіслано ${userCount} користувачам.</i>`
  );
}

export function adminBroadcastResultMessage(sent: number, failed: number): string {
  return (
    `📢 <b>Розсилка завершена</b>\n\n` +
    `✅ Надіслано: ${sent}\n` +
    `❌ Помилок: ${failed}`
  );
}

export function adminSettingsMessage(options: {
  registrationOpen: boolean;
  scheduleInterval: number;
  powerInterval: number;
  debounceMinutes: number;
}): string {
  const regStatus = options.registrationOpen ? "✅ Відкрита" : "❌ Закрита";
  return (
    `⚙️ <b>Налаштування бота</b>\n\n` +
    `📝 Реєстрація: ${regStatus}\n` +
    `⏱ Інтервал перевірки графіків: ${options.scheduleInterval}с\n` +
    `📡 Інтервал перевірки IP: ${options.powerInterval}с\n` +
    `⏳ Debounce живлення: ${options.debounceMinutes}хв`
  );
}

export function adminMaintenanceMessage(isActive: boolean): string {
  const status = isActive ? "🔧 Активні" : "✅ Вимкнені";
  return `🔧 <b>Технічні роботи</b>\n\nСтатус: ${status}`;
}

export function adminRouterMessage(): string {
  return `📡 <b>Роутер адміна</b>\n\nМоніторинг адмінських роутерів.`;
}

export function adminPauseMessage(isPaused: boolean): string {
  const status = isPaused ? "⏸ На паузі" : "▶️ Працює";
  return `⏸ <b>Пауза бота</b>\n\nСтатус: ${status}`;
}
