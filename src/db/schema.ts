import {
  pgTable,
  serial,
  varchar,
  boolean,
  integer,
  text,
  timestamp,
  bigint,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

// ============================================================
// users
// ============================================================
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    telegramId: varchar("telegram_id", { length: 64 }).notNull().unique(),
    username: varchar("username", { length: 255 }),
    region: varchar("region", { length: 64 }).notNull(),
    queue: varchar("queue", { length: 16 }).notNull(),
    routerIp: varchar("router_ip", { length: 255 }),
    isActive: boolean("is_active").notNull().default(true),
    isBlocked: boolean("is_blocked").notNull().default(false),
    lastMenuMessageId: integer("last_menu_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("users_telegram_id_idx").on(table.telegramId)],
);

// ============================================================
// user_notification_settings
// ============================================================
export const userNotificationSettings = pgTable("user_notification_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  notifyScheduleChanges: boolean("notify_schedule_changes").notNull().default(true),
  notifyRemindOff: boolean("notify_remind_off").notNull().default(true),
  notifyFactOff: boolean("notify_fact_off").notNull().default(true),
  notifyRemindOn: boolean("notify_remind_on").notNull().default(true),
  notifyFactOn: boolean("notify_fact_on").notNull().default(true),
  remind15m: boolean("remind_15m").notNull().default(true),
  remind30m: boolean("remind_30m").notNull().default(false),
  remind1h: boolean("remind_1h").notNull().default(false),
  notifyScheduleTarget: varchar("notify_schedule_target", { length: 16 })
    .notNull()
    .default("bot"),
  notifyRemindTarget: varchar("notify_remind_target", { length: 16 }).notNull().default("bot"),
  notifyPowerTarget: varchar("notify_power_target", { length: 16 }).notNull().default("bot"),
  autoDeleteCommands: boolean("auto_delete_commands").notNull().default(false),
  autoDeleteBotMessages: boolean("auto_delete_bot_messages").notNull().default(false),
});

// ============================================================
// user_channel_config
// ============================================================
export const userChannelConfig = pgTable("user_channel_config", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  channelId: varchar("channel_id", { length: 64 }),
  channelTitle: varchar("channel_title", { length: 255 }),
  channelDescription: text("channel_description"),
  channelPhotoFileId: varchar("channel_photo_file_id", { length: 255 }),
  channelUserTitle: varchar("channel_user_title", { length: 255 }),
  channelUserDescription: text("channel_user_description"),
  channelStatus: varchar("channel_status", { length: 32 }).notNull().default("active"),
  channelPaused: boolean("channel_paused").notNull().default(false),
  channelBrandingUpdatedAt: timestamp("channel_branding_updated_at", { withTimezone: true }),
  channelGuardWarnings: integer("channel_guard_warnings").notNull().default(0),
  lastPublishedHash: varchar("last_published_hash", { length: 128 }),
  lastPostId: integer("last_post_id"),
  lastScheduleMessageId: integer("last_schedule_message_id"),
  lastPowerMessageId: integer("last_power_message_id"),
  scheduleCaption: text("schedule_caption"),
  periodFormat: text("period_format"),
  powerOffText: text("power_off_text"),
  powerOnText: text("power_on_text"),
  deleteOldMessage: boolean("delete_old_message").notNull().default(false),
  pictureOnly: boolean("picture_only").notNull().default(false),
  chNotifySchedule: boolean("ch_notify_schedule").notNull().default(true),
  chNotifyRemindOff: boolean("ch_notify_remind_off").notNull().default(true),
  chNotifyRemindOn: boolean("ch_notify_remind_on").notNull().default(true),
  chNotifyFactOff: boolean("ch_notify_fact_off").notNull().default(true),
  chNotifyFactOn: boolean("ch_notify_fact_on").notNull().default(true),
  chRemind15m: boolean("ch_remind_15m").notNull().default(true),
  chRemind30m: boolean("ch_remind_30m").notNull().default(false),
  chRemind1h: boolean("ch_remind_1h").notNull().default(false),
});

// ============================================================
// user_power_tracking
// ============================================================
export const userPowerTracking = pgTable("user_power_tracking", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  powerState: varchar("power_state", { length: 16 }),
  powerChangedAt: timestamp("power_changed_at", { withTimezone: true }),
  pendingPowerState: varchar("pending_power_state", { length: 16 }),
  pendingPowerChangeAt: timestamp("pending_power_change_at", { withTimezone: true }),
  lastPowerState: varchar("last_power_state", { length: 16 }),
  lastPowerChange: integer("last_power_change"),
  powerOnDuration: integer("power_on_duration"),
  lastAlertOffPeriod: varchar("last_alert_off_period", { length: 64 }),
  lastAlertOnPeriod: varchar("last_alert_on_period", { length: 64 }),
  alertOffMessageId: integer("alert_off_message_id"),
  alertOnMessageId: integer("alert_on_message_id"),
  lastPingErrorAt: timestamp("last_ping_error_at", { withTimezone: true }),
  botPowerMessageId: bigint("bot_power_message_id", { mode: "number" }),
  chPowerMessageId: bigint("ch_power_message_id", { mode: "number" }),
  powerMessageType: varchar("power_message_type", { length: 16 }),
});

// ============================================================
// user_message_tracking
// ============================================================
export const userMessageTracking = pgTable("user_message_tracking", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  lastBotMessageId: integer("last_bot_message_id"),
  lastCommandMessageId: integer("last_command_message_id"),
});

// ============================================================
// settings (key/value store)
// ============================================================
export const settings = pgTable("settings", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ============================================================
// tickets + ticket_messages
// ============================================================
export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [index("tickets_user_id_idx").on(table.userId)],
);

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    senderType: varchar("sender_type", { length: 16 }).notNull(), // "user" | "admin"
    messageText: text("message_text"),
    telegramMessageId: integer("telegram_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ticket_messages_ticket_id_idx").on(table.ticketId)],
);

// ============================================================
// outage_history
// ============================================================
export const outageHistory = pgTable(
  "outage_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),
    source: varchar("source", { length: 32 }), // "ip" | "schedule"
  },
  (table) => [index("outage_history_user_id_idx").on(table.userId)],
);

// ============================================================
// power_history
// ============================================================
export const powerHistory = pgTable(
  "power_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: varchar("state", { length: 16 }).notNull(), // "on" | "off"
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("power_history_user_id_idx").on(table.userId)],
);

// ============================================================
// schedule_history
// ============================================================
export const scheduleHistory = pgTable("schedule_history", {
  id: serial("id").primaryKey(),
  region: varchar("region", { length: 64 }).notNull(),
  queue: varchar("queue", { length: 16 }).notNull(),
  contentHash: varchar("content_hash", { length: 128 }).notNull(),
  data: text("data"), // JSON snapshot
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// schedule_checks (region+queue composite PK)
// ============================================================
export const scheduleChecks = pgTable(
  "schedule_checks",
  {
    region: varchar("region", { length: 64 }).notNull(),
    queue: varchar("queue", { length: 16 }).notNull(),
    lastHash: varchar("last_hash", { length: 128 }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.region, table.queue] })],
);

// ============================================================
// schedule_daily_snapshots
// ============================================================
export const scheduleDailySnapshots = pgTable(
  "schedule_daily_snapshots",
  {
    id: serial("id").primaryKey(),
    region: varchar("region", { length: 64 }).notNull(),
    queue: varchar("queue", { length: 16 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
    data: text("data"), // JSON
    contentHash: varchar("content_hash", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("schedule_daily_snapshots_region_queue_date_idx").on(table.region, table.queue, table.date)],
);

// ============================================================
// pending_notifications
// ============================================================
export const pendingNotifications = pgTable(
  "pending_notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    payload: text("payload"), // JSON
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("pending_notifications_user_id_idx").on(table.userId)],
);

// ============================================================
// ping_error_alerts
// ============================================================
export const pingErrorAlerts = pgTable("ping_error_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// sent_reminders (deduplication)
// ============================================================
export const sentReminders = pgTable(
  "sent_reminders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reminderKey: varchar("reminder_key", { length: 255 }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sent_reminders_user_id_key_idx").on(table.userId, table.reminderKey)],
);

// ============================================================
// user_power_states (telegram_id PK — for power monitor)
// ============================================================
export const userPowerStates = pgTable("user_power_states", {
  telegramId: varchar("telegram_id", { length: 64 }).primaryKey(),
  routerIp: varchar("router_ip", { length: 255 }),
  powerState: varchar("power_state", { length: 16 }), // "online" | "offline" | null
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastChangedAt: timestamp("last_changed_at", { withTimezone: true }),
});

// ============================================================
// pending_channels
// ============================================================
export const pendingChannels = pgTable("pending_channels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channelId: varchar("channel_id", { length: 64 }).notNull(),
  channelTitle: varchar("channel_title", { length: 255 }),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// pause_log
// ============================================================
export const pauseLog = pgTable("pause_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id"),
  action: varchar("action", { length: 32 }).notNull(), // "pause" | "resume"
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// admin_routers
// ============================================================
export const adminRouters = pgTable("admin_routers", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  routerIp: varchar("router_ip", { length: 255 }).notNull(),
  label: varchar("label", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// admin_router_history
// ============================================================
export const adminRouterHistory = pgTable("admin_router_history", {
  id: serial("id").primaryKey(),
  routerId: integer("router_id")
    .notNull()
    .references(() => adminRouters.id, { onDelete: "cascade" }),
  state: varchar("state", { length: 16 }).notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// admin_ticket_reminders
// ============================================================
export const adminTicketReminders = pgTable("admin_ticket_reminders", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  adminId: integer("admin_id").notNull(),
  remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
  sent: boolean("sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
