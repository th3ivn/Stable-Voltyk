import { InlineKeyboard } from "grammy";
import { REGIONS, STANDARD_QUEUES, KYIV_EXTRA_QUEUES } from "../constants/regions.js";

// ============================================================
// Wizard: Region selection
// ============================================================
export function wizardRegionKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const entries = Object.entries(REGIONS);
  for (let i = 0; i < entries.length; i += 2) {
    const first = entries[i];
    const second = entries[i + 1];
    if (first !== undefined) {
      kb.text(first[1].name, `region_${first[0]}`);
    }
    if (second !== undefined) {
      kb.text(second[1].name, `region_${second[0]}`);
    }
    kb.row();
  }
  return kb;
}

// ============================================================
// Wizard: Queue selection (with pagination for Kyiv)
// ============================================================
export function wizardQueueKeyboard(regionCode: string, page = 1): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (regionCode === "kyiv" && page === 1) {
    // Page 1: standard queues + "Інші черги →"
    for (let i = 0; i < STANDARD_QUEUES.length; i += 3) {
      const row = STANDARD_QUEUES.slice(i, i + 3);
      for (const q of row) {
        kb.text(q, `queue_${q}`);
      }
      kb.row();
    }
    kb.text("Інші черги →", "queue_page_2");
    return kb;
  }

  if (regionCode === "kyiv" && page >= 2) {
    const perPage = 16; // 4 per row × 4 rows
    const startIdx = (page - 2) * perPage;
    const pageQueues = KYIV_EXTRA_QUEUES.slice(startIdx, startIdx + perPage);

    for (let i = 0; i < pageQueues.length; i += 4) {
      const row = pageQueues.slice(i, i + 4);
      for (const q of row) {
        kb.text(q, `queue_${q}`);
      }
      kb.row();
    }

    const hasNext = startIdx + perPage < KYIV_EXTRA_QUEUES.length;
    const hasPrev = page > 2;

    if (hasPrev) kb.text("← Назад", `queue_page_${page - 1}`);
    if (page === 2) kb.text("← Назад", "queue_page_1");
    if (hasNext) kb.text("Далі →", `queue_page_${page + 1}`);
    kb.row();

    return kb;
  }

  // Non-Kyiv: standard queues, 3 per row
  for (let i = 0; i < STANDARD_QUEUES.length; i += 3) {
    const row = STANDARD_QUEUES.slice(i, i + 3);
    for (const q of row) {
      kb.text(q, `queue_${q}`);
    }
    kb.row();
  }
  return kb;
}

// ============================================================
// Wizard: Notification target
// ============================================================
export function wizardNotifyTargetKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📱 У цьому боті", "wizard_notify_bot")
    .row()
    .text("📺 У Telegram-каналі", "wizard_notify_channel")
    .row();
}

// ============================================================
// Wizard: Bot notification settings
// ============================================================
export function wizardNotifSettingsKeyboard(settings: {
  schedule: boolean;
  remind15m: boolean;
  remind30m: boolean;
  remind1h: boolean;
  fact: boolean;
}): InlineKeyboard {
  const on = "✅";
  const off = "❌";
  return new InlineKeyboard()
    .text(
      `${settings.schedule ? on : off} Оновлення графіків`,
      "wizard_notif_toggle_schedule",
    )
    .row()
    .text(`${settings.remind1h ? on : off} 1 год`, "wizard_notif_time_60")
    .text(`${settings.remind30m ? on : off} 30 хв`, "wizard_notif_time_30")
    .text(`${settings.remind15m ? on : off} 15 хв`, "wizard_notif_time_15")
    .row()
    .text(
      `${settings.fact ? on : off} Фактично за IP-адресою`,
      "wizard_notif_toggle_fact",
    )
    .row()
    .text("← Назад", "wizard_notify_back")
    .text("✓ Готово!", "wizard_bot_done")
    .row();
}

// ============================================================
// Wizard: Done
// ============================================================
export function wizardDoneKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⤵ Меню", "back_to_main")
    .url("📢 Новини бота", "https://t.me/Voltyk_news")
    .row();
}

// ============================================================
// Main menu
// ============================================================
export function mainMenuKeyboard(options: {
  hasChannel: boolean;
  channelPaused: boolean;
}): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("📊 Графік", "menu_schedule")
    .text("❓ Допомога", "menu_help")
    .row()
    .text("🔔 Сповіщення", "settings_alerts")
    .text("📺 Канал", "settings_channel")
    .row()
    .text("⚙️ Налаштування", "menu_settings")
    .row();

  if (options.hasChannel) {
    if (options.channelPaused) {
      kb.text("▶️ Відновити роботу каналу", "channel_resume").row();
    } else {
      kb.text("⏸ Тимчасово зупинити канал", "channel_pause").row();
    }
  }

  return kb;
}

// ============================================================
// Schedule
// ============================================================
export function scheduleKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📍 Замінити", "my_queues")
    .text("🔄 Перевірити", "schedule_check")
    .row()
    .text("⤴ Меню", "back_to_main")
    .row();
}

// ============================================================
// Settings
// ============================================================
export function settingsKeyboard(options: { isAdmin: boolean }): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("📍 Регіон", "settings_region")
    .text("📡 IP", "settings_ip")
    .row()
    .text("📺 Канал", "settings_channel")
    .text("🔔 Сповіщення", "settings_alerts")
    .row()
    .text("🗑 Очищення", "settings_cleanup")
    .row();

  if (options.isAdmin) {
    kb.text("👑 Адмін-панель", "settings_admin").row();
  }

  kb.text("🗑 Видалити мої дані", "settings_delete_data").row();
  kb.text("⤴ Меню", "back_to_main").row();

  return kb;
}

// ============================================================
// Help
// ============================================================
export function helpKeyboard(
  newsUrl: string,
  discussUrl: string,
): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text("📖 Інструкція", "help_instruction")
    .row()
    .text("❓ FAQ", "help_faq")
    .text("💬 Підтримка", "help_support")
    .row();

  if (newsUrl.length > 0) kb.url("📢 Новини ↗", newsUrl);
  if (discussUrl.length > 0) kb.url("💬 Обговорення ↗", discussUrl);
  if (newsUrl.length > 0 || discussUrl.length > 0) kb.row();

  kb.text("⤴ Меню", "back_to_main").row();
  return kb;
}

// ============================================================
// Instruction sections
// ============================================================
export function instructionMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📍 Регіон і черга", "instr_region")
    .row()
    .text("🔔 Сповіщення", "instr_notif")
    .row()
    .text("📺 Канал", "instr_channel")
    .row()
    .text("📡 IP моніторинг", "instr_ip")
    .row()
    .text("📊 Графік відключень", "instr_schedule")
    .row()
    .text("⚙️ Налаштування бота", "instr_bot_settings")
    .row()
    .text("← Назад", "menu_help")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function instructionBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("← Назад", "help_instruction")
    .text("⤴ Меню", "back_to_main")
    .row();
}

// ============================================================
// FAQ
// ============================================================
export function faqKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("← Назад", "menu_help")
    .text("⤴ Меню", "back_to_main")
    .row();
}

// ============================================================
// Support
// ============================================================
export function supportKeyboard(supportUrl: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (supportUrl.length > 0) {
    kb.url("✉️ Написати", supportUrl).row();
  }
  kb.text("← Назад", "menu_help")
    .text("⤴ Меню", "back_to_main")
    .row();
  return kb;
}

// ============================================================
// Alerts: target selection (when user has channel)
// ============================================================
export function alertsTargetKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📱 Сповіщення в боті", "notif_select_bot")
    .row()
    .text("📺 Сповіщення для каналу", "notif_select_channel")
    .row()
    .text("← Назад", "back_to_main")
    .row();
}

// ============================================================
// Alerts: notification toggle keyboard
// ============================================================
export function notificationSettingsKeyboard(
  settings: {
    scheduleChanges: boolean;
    remindOff: boolean;
    remindOn: boolean;
    factOff: boolean;
    factOn: boolean;
    remind15m: boolean;
    remind30m: boolean;
    remind1h: boolean;
  },
  prefix: string, // "notif_bot" or "notif_ch"
): InlineKeyboard {
  const on = "✅";
  const off = "❌";
  return new InlineKeyboard()
    .text(
      `${settings.scheduleChanges ? on : off} Оновлення графіків`,
      `${prefix}_toggle_schedule`,
    )
    .row()
    .text(`${settings.remind1h ? on : off} 1 год`, `${prefix}_time_60`)
    .text(`${settings.remind30m ? on : off} 30 хв`, `${prefix}_time_30`)
    .text(`${settings.remind15m ? on : off} 15 хв`, `${prefix}_time_15`)
    .row()
    .text(
      `${settings.remindOff ? on : off} Нагад. перед вимкн.`,
      `${prefix}_toggle_remind_off`,
    )
    .text(
      `${settings.remindOn ? on : off} Нагад. перед вкл.`,
      `${prefix}_toggle_remind_on`,
    )
    .row()
    .text(
      `${settings.factOff ? on : off} Факт. вимкнення`,
      `${prefix}_toggle_fact_off`,
    )
    .text(
      `${settings.factOn ? on : off} Факт. увімкнення`,
      `${prefix}_toggle_fact_on`,
    )
    .row()
    .text("← Назад", `${prefix}_back`)
    .text("⤴ Меню", "back_to_main")
    .row();
}

// ============================================================
// IP monitoring
// ============================================================
export function ipNoIpKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("❌ Скасувати", "ip_cancel_to_settings").row();
}

export function ipWithIpKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ Змінити IP", "ip_change")
    .text("🗑 Видалити IP", "ip_delete")
    .row()
    .text("📡 Перевірити пінг", "ip_ping_check")
    .row()
    .text("← Назад", "menu_settings")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function ipConfirmDeleteKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Ні", "settings_ip")
    .text("Так, видалити", "ip_confirm_delete")
    .row();
}

// ============================================================
// Channel
// ============================================================
export function channelNoChannelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✚ Підключити канал", "channel_connect")
    .row()
    .text("← Назад", "menu_settings")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function channelWithChannelKeyboard(options: {
  channelUrl?: string;
  isPublic: boolean;
}): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (options.isPublic && options.channelUrl !== undefined && options.channelUrl.length > 0) {
    kb.url("📺 Відкрити канал", options.channelUrl).row();
  }

  kb.text("ℹ️ Інфо", "channel_info")
    .text("✏️ Назва", "channel_edit_title")
    .row()
    .text("📝 Опис", "channel_edit_desc")
    .text("📋 Формат", "channel_format")
    .row()
    .text("🧪 Тест", "channel_test")
    .text("🔴 Вимкнути", "channel_disconnect")
    .row()
    .text("🔔 Сповіщення", "channel_notifications")
    .row()
    .text("← Назад", "menu_settings")
    .text("⤴ Меню", "back_to_main")
    .row();

  return kb;
}

export function channelConnectInstructionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("← Назад", "settings_channel")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function channelInfoKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("← Назад", "settings_channel")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function channelEditInputKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("❌ Скасувати", "channel_cancel_edit").row();
}

export function channelFormatKeyboard(options: {
  pictureOnly: boolean;
  deleteOldMessage: boolean;
}): InlineKeyboard {
  const on = "✅";
  const off = "❌";
  return new InlineKeyboard()
    .text(
      `${options.pictureOnly ? on : off} Тільки зображення`,
      "channel_toggle_picture_only",
    )
    .row()
    .text(
      `${options.deleteOldMessage ? on : off} Видаляти старе повідомлення`,
      "channel_toggle_delete_old",
    )
    .row()
    .text("← Назад", "settings_channel")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function channelNotificationsKeyboard(settings: {
  chNotifySchedule: boolean;
  chNotifyRemindOff: boolean;
  chNotifyRemindOn: boolean;
  chNotifyFactOff: boolean;
  chNotifyFactOn: boolean;
  chRemind15m: boolean;
  chRemind30m: boolean;
  chRemind1h: boolean;
}): InlineKeyboard {
  const on = "✅";
  const off = "❌";
  return new InlineKeyboard()
    .text(
      `${settings.chNotifySchedule ? on : off} Оновлення графіків`,
      "ch_toggle_schedule",
    )
    .row()
    .text(`${settings.chRemind1h ? on : off} 1 год`, "ch_time_60")
    .text(`${settings.chRemind30m ? on : off} 30 хв`, "ch_time_30")
    .text(`${settings.chRemind15m ? on : off} 15 хв`, "ch_time_15")
    .row()
    .text(
      `${settings.chNotifyRemindOff ? on : off} Нагад. перед вимкн.`,
      "ch_toggle_remind_off",
    )
    .text(
      `${settings.chNotifyRemindOn ? on : off} Нагад. перед вкл.`,
      "ch_toggle_remind_on",
    )
    .row()
    .text(
      `${settings.chNotifyFactOff ? on : off} Факт. вимкнення`,
      "ch_toggle_fact_off",
    )
    .text(
      `${settings.chNotifyFactOn ? on : off} Факт. увімкнення`,
      "ch_toggle_fact_on",
    )
    .row()
    .text("← Назад", "settings_channel")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function channelTestKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("← Назад", "settings_channel")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function pendingChannelKeyboard(pendingId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Підключити", `pending_channel_confirm_${pendingId}`)
    .text("❌ Відхилити", `pending_channel_reject_${pendingId}`)
    .row();
}

// ============================================================
// Stats
// ============================================================
export function statsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⚡ Відключення за тиждень", "stats_week")
    .row()
    .text("📡 Статус пристрою", "stats_device")
    .row()
    .text("⚙️ Мої налаштування", "stats_my_settings")
    .row()
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function statsBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("← Назад", "menu_stats")
    .text("⤴ Меню", "back_to_main")
    .row();
}

// ============================================================
// Cleanup
// ============================================================
export function cleanupKeyboard(settings: {
  autoDeleteCommands: boolean;
  autoDeleteBotMessages: boolean;
}): InlineKeyboard {
  const on = "✅";
  const off = "❌";
  return new InlineKeyboard()
    .text(
      `${settings.autoDeleteCommands ? on : off} ⌨️ Видаляти команди`,
      "cleanup_toggle_commands",
    )
    .row()
    .text(
      `${settings.autoDeleteBotMessages ? on : off} 💬 Видаляти старі відповіді`,
      "cleanup_toggle_messages",
    )
    .row()
    .text("← Назад", "menu_settings")
    .text("⤴ Меню", "back_to_main")
    .row();
}

// ============================================================
// Delete data
// ============================================================
export function deleteDataStep1Keyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Скасувати", "menu_settings")
    .text("Продовжити", "delete_data_confirm")
    .row();
}

export function deleteDataStep2Keyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Ні", "menu_settings")
    .text("Так, видалити", "delete_data_execute")
    .row();
}

// ============================================================
// Reminder
// ============================================================
export function reminderKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 Графік", "reminder_show_schedule")
    .text("👌 Зрозуміло", "reminder_dismiss")
    .row();
}

// ============================================================
// Deactivated user
// ============================================================
export function deactivatedUserKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Відновити налаштування", "restore_profile")
    .row()
    .text("🆕 Почати заново", "create_new_profile")
    .row();
}

// ============================================================
// Region change (from settings)
// ============================================================
export function regionChangeKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  const entries = Object.entries(REGIONS);
  for (let i = 0; i < entries.length; i += 2) {
    const first = entries[i];
    const second = entries[i + 1];
    if (first !== undefined) {
      kb.text(first[1].name, `change_region_${first[0]}`);
    }
    if (second !== undefined) {
      kb.text(second[1].name, `change_region_${second[0]}`);
    }
    kb.row();
  }
  kb.text("← Назад", "menu_settings").text("⤴ Меню", "back_to_main").row();
  return kb;
}

export function queueChangeKeyboard(regionCode: string, page = 1): InlineKeyboard {
  const kb = wizardQueueKeyboard(regionCode, page);
  kb.text("← Назад", "settings_region").text("⤴ Меню", "back_to_main").row();
  return kb;
}

// ============================================================
// Admin panel
// ============================================================
export function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 Аналітика", "admin_analytics")
    .text("👥 Користувачі", "admin_users")
    .row()
    .text("📢 Розсилка", "admin_broadcast")
    .row()
    .text("⚙️ Налаштування", "admin_settings")
    .text("📡 Роутер", "admin_router")
    .row()
    .text("🔧 Тех. роботи", "admin_maintenance")
    .row()
    .text("← Назад", "menu_settings")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function adminBackKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("← Назад", "settings_admin")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function adminAnalyticsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📈 За тиждень", "admin_analytics_week")
    .text("📊 За місяць", "admin_analytics_month")
    .row()
    .text("← Назад", "settings_admin")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function adminUsersKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📊 Статистика", "admin_users_stats")
    .row()
    .text("← Назад", "settings_admin")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function adminBroadcastKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("❌ Скасувати", "admin_broadcast_cancel")
    .row();
}

export function adminBroadcastConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Надіслати", "admin_broadcast_send")
    .text("❌ Скасувати", "admin_broadcast_cancel")
    .row();
}

export function adminSettingsKeyboard(options: {
  registrationOpen: boolean;
  scheduleInterval: number;
  powerInterval: number;
  debounceMinutes: number;
}): InlineKeyboard {
  const regStatus = options.registrationOpen ? "✅" : "❌";
  return new InlineKeyboard()
    .text(`${regStatus} Реєстрація`, "admin_toggle_registration")
    .row()
    .text(`⏱ Графік: ${options.scheduleInterval}с`, "admin_set_schedule_interval")
    .row()
    .text(`📡 IP: ${options.powerInterval}с`, "admin_set_power_interval")
    .row()
    .text(`⏳ Debounce: ${options.debounceMinutes}хв`, "admin_set_debounce")
    .row()
    .text("← Назад", "settings_admin")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function adminMaintenanceKeyboard(isMaintenanceMode: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (isMaintenanceMode) {
    kb.text("✅ Вимкнути тех. роботи", "admin_maintenance_off").row();
  } else {
    kb.text("🔧 Увімкнути тех. роботи", "admin_maintenance_on").row();
  }
  kb.text("← Назад", "settings_admin")
    .text("⤴ Меню", "back_to_main")
    .row();
  return kb;
}

export function adminRouterKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📡 Перевірити", "admin_router_ping")
    .row()
    .text("← Назад", "settings_admin")
    .text("⤴ Меню", "back_to_main")
    .row();
}

export function adminPauseKeyboard(isPaused: boolean): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (isPaused) {
    kb.text("▶️ Відновити бота", "admin_pause_off").row();
  } else {
    kb.text("⏸ Поставити на паузу", "admin_pause_on").row();
  }
  kb.text("← Назад", "settings_admin")
    .text("⤴ Меню", "back_to_main")
    .row();
  return kb;
}

// ============================================================
// Back + Menu (generic)
// ============================================================
export function backToMainKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("⤴ Меню", "back_to_main").row();
}

export function backAndMenuKeyboard(backCallback: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("← Назад", backCallback)
    .text("⤴ Меню", "back_to_main")
    .row();
}
