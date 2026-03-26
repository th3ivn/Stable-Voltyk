import { eq, and } from "drizzle-orm";
import type { Database } from "../client.js";
import {
  users,
  userNotificationSettings,
  userChannelConfig,
  userPowerTracking,
  userMessageTracking,
  pendingChannels,
} from "../schema.js";

// ============================================================
// Find user by telegram_id
// ============================================================
export async function findUserByTelegramId(db: Database, telegramId: string) {
  const rows = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
  return rows[0] ?? null;
}

// ============================================================
// Find user with all related data
// ============================================================
export async function findUserWithRelations(db: Database, telegramId: string) {
  const user = await findUserByTelegramId(db, telegramId);
  if (user === null) return null;

  const [notifSettings, channelConfig, powerTracking, messageTracking] = await Promise.all([
    db
      .select()
      .from(userNotificationSettings)
      .where(eq(userNotificationSettings.userId, user.id))
      .limit(1),
    db
      .select()
      .from(userChannelConfig)
      .where(eq(userChannelConfig.userId, user.id))
      .limit(1),
    db
      .select()
      .from(userPowerTracking)
      .where(eq(userPowerTracking.userId, user.id))
      .limit(1),
    db
      .select()
      .from(userMessageTracking)
      .where(eq(userMessageTracking.userId, user.id))
      .limit(1),
  ]);

  return {
    user,
    notificationSettings: notifSettings[0] ?? null,
    channelConfig: channelConfig[0] ?? null,
    powerTracking: powerTracking[0] ?? null,
    messageTracking: messageTracking[0] ?? null,
  };
}

// ============================================================
// Create user + default related rows
// ============================================================
export async function createUser(
  db: Database,
  data: { telegramId: string; username?: string | null; region: string; queue: string },
) {
  const [newUser] = await db
    .insert(users)
    .values({
      telegramId: data.telegramId,
      username: data.username ?? null,
      region: data.region,
      queue: data.queue,
    })
    .returning();

  if (newUser === undefined) {
    throw new Error("Failed to create user");
  }

  // Create default related rows
  await Promise.all([
    db.insert(userNotificationSettings).values({ userId: newUser.id }),
    db.insert(userChannelConfig).values({ userId: newUser.id }),
    db.insert(userPowerTracking).values({ userId: newUser.id }),
    db.insert(userMessageTracking).values({ userId: newUser.id }),
  ]);

  return newUser;
}

// ============================================================
// Update user fields
// ============================================================
export async function updateUser(
  db: Database,
  userId: number,
  data: Partial<{
    username: string | null;
    region: string;
    queue: string;
    routerIp: string | null;
    isActive: boolean;
    isBlocked: boolean;
    lastMenuMessageId: number | null;
  }>,
) {
  const [updated] = await db.update(users).set(data).where(eq(users.id, userId)).returning();
  return updated ?? null;
}

// ============================================================
// Update notification settings
// ============================================================
export async function updateNotificationSettings(
  db: Database,
  userId: number,
  data: Partial<{
    notifyScheduleChanges: boolean;
    notifyRemindOff: boolean;
    notifyFactOff: boolean;
    notifyRemindOn: boolean;
    notifyFactOn: boolean;
    remind15m: boolean;
    remind30m: boolean;
    remind1h: boolean;
    notifyScheduleTarget: string;
    notifyRemindTarget: string;
    notifyPowerTarget: string;
    autoDeleteCommands: boolean;
    autoDeleteBotMessages: boolean;
  }>,
) {
  const [updated] = await db
    .update(userNotificationSettings)
    .set(data)
    .where(eq(userNotificationSettings.userId, userId))
    .returning();
  return updated ?? null;
}

// ============================================================
// Update channel config
// ============================================================
export async function updateChannelConfig(
  db: Database,
  userId: number,
  data: Partial<{
    channelId: string | null;
    channelTitle: string | null;
    channelDescription: string | null;
    channelPhotoFileId: string | null;
    channelUserTitle: string | null;
    channelUserDescription: string | null;
    channelStatus: string;
    channelPaused: boolean;
    channelBrandingUpdatedAt: Date | null;
    channelGuardWarnings: number;
    lastPublishedHash: string | null;
    lastPostId: number | null;
    lastScheduleMessageId: number | null;
    lastPowerMessageId: number | null;
    scheduleCaption: string | null;
    periodFormat: string | null;
    powerOffText: string | null;
    powerOnText: string | null;
    deleteOldMessage: boolean;
    pictureOnly: boolean;
    chNotifySchedule: boolean;
    chNotifyRemindOff: boolean;
    chNotifyRemindOn: boolean;
    chNotifyFactOff: boolean;
    chNotifyFactOn: boolean;
    chRemind15m: boolean;
    chRemind30m: boolean;
    chRemind1h: boolean;
  }>,
) {
  const [updated] = await db
    .update(userChannelConfig)
    .set(data)
    .where(eq(userChannelConfig.userId, userId))
    .returning();
  return updated ?? null;
}

// ============================================================
// Update power tracking
// ============================================================
export async function updatePowerTracking(
  db: Database,
  userId: number,
  data: Partial<{
    powerState: string | null;
    powerChangedAt: Date | null;
    pendingPowerState: string | null;
    pendingPowerChangeAt: Date | null;
    lastPowerState: string | null;
    lastPowerChange: number | null;
    powerOnDuration: number | null;
    lastAlertOffPeriod: string | null;
    lastAlertOnPeriod: string | null;
    alertOffMessageId: number | null;
    alertOnMessageId: number | null;
    lastPingErrorAt: Date | null;
    botPowerMessageId: number | null;
    chPowerMessageId: number | null;
    powerMessageType: string | null;
  }>,
) {
  const [updated] = await db
    .update(userPowerTracking)
    .set(data)
    .where(eq(userPowerTracking.userId, userId))
    .returning();
  return updated ?? null;
}

// ============================================================
// Deactivate user (soft delete)
// ============================================================
export async function deactivateUser(db: Database, userId: number) {
  return updateUser(db, userId, { isActive: false });
}

// ============================================================
// Reactivate user
// ============================================================
export async function reactivateUser(db: Database, userId: number) {
  return updateUser(db, userId, { isActive: true, isBlocked: false });
}

// ============================================================
// Delete user and all related data (hard delete)
// ============================================================
export async function deleteUser(db: Database, userId: number) {
  await db.delete(users).where(eq(users.id, userId));
}

// ============================================================
// Count active users
// ============================================================
export async function countActiveUsers(db: Database): Promise<number> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.isActive, true));
  return rows.length;
}

// ============================================================
// Get all active users with IP for power monitoring
// ============================================================
export async function getUsersWithIp(db: Database) {
  return db
    .select({
      id: users.id,
      telegramId: users.telegramId,
      routerIp: users.routerIp,
      region: users.region,
      queue: users.queue,
    })
    .from(users)
    .where(eq(users.isActive, true));
}

// ============================================================
// Pending channels
// ============================================================
export async function createPendingChannel(
  db: Database,
  userId: number,
  channelId: string,
  channelTitle: string,
) {
  const [row] = await db
    .insert(pendingChannels)
    .values({ userId, channelId, channelTitle })
    .returning();
  return row ?? null;
}

export async function findPendingChannel(db: Database, id: number) {
  const rows = await db
    .select()
    .from(pendingChannels)
    .where(eq(pendingChannels.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deletePendingChannel(db: Database, id: number) {
  await db.delete(pendingChannels).where(eq(pendingChannels.id, id));
}

export async function findPendingChannelByChannelId(
  db: Database,
  userId: number,
  channelId: string,
) {
  const rows = await db
    .select()
    .from(pendingChannels)
    .where(
      and(
        eq(pendingChannels.userId, userId),
        eq(pendingChannels.channelId, channelId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
