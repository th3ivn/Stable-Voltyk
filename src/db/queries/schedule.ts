import { eq, and, lt } from "drizzle-orm";
import type { Database } from "../client.js";
import {
  scheduleChecks,
  scheduleDailySnapshots,
  pendingNotifications,
  sentReminders,
  scheduleHistory,
} from "../schema.js";

// ============================================================
// Schedule checks
// ============================================================
export async function getScheduleCheck(db: Database, region: string, queue: string) {
  const rows = await db
    .select()
    .from(scheduleChecks)
    .where(and(eq(scheduleChecks.region, region), eq(scheduleChecks.queue, queue)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertScheduleCheck(
  db: Database,
  region: string,
  queue: string,
  data: { lastHash?: string; lastCheckedAt?: Date; lastChangedAt?: Date },
) {
  await db
    .insert(scheduleChecks)
    .values({
      region,
      queue,
      lastHash: data.lastHash ?? null,
      lastCheckedAt: data.lastCheckedAt ?? new Date(),
      lastChangedAt: data.lastChangedAt ?? null,
    })
    .onConflictDoUpdate({
      target: [scheduleChecks.region, scheduleChecks.queue],
      set: data,
    });
}

// ============================================================
// Schedule daily snapshots
// ============================================================
export async function getSnapshot(db: Database, region: string, queue: string, date: string) {
  const rows = await db
    .select()
    .from(scheduleDailySnapshots)
    .where(
      and(
        eq(scheduleDailySnapshots.region, region),
        eq(scheduleDailySnapshots.queue, queue),
        eq(scheduleDailySnapshots.date, date),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertSnapshot(
  db: Database,
  region: string,
  queue: string,
  date: string,
  data: string,
  contentHash: string,
) {
  const existing = await getSnapshot(db, region, queue, date);
  if (existing !== null) {
    await db
      .update(scheduleDailySnapshots)
      .set({ data, contentHash })
      .where(eq(scheduleDailySnapshots.id, existing.id));
  } else {
    await db.insert(scheduleDailySnapshots).values({ region, queue, date, data, contentHash });
  }
}

// ============================================================
// Schedule history
// ============================================================
export async function addScheduleHistory(
  db: Database,
  region: string,
  queue: string,
  contentHash: string,
  data: string,
) {
  await db.insert(scheduleHistory).values({ region, queue, contentHash, data });
}

// ============================================================
// Pending notifications
// ============================================================
export async function addPendingNotification(
  db: Database,
  userId: number,
  type: string,
  payload: string,
  scheduledAt?: Date,
) {
  await db.insert(pendingNotifications).values({
    userId,
    type,
    payload,
    scheduledAt: scheduledAt ?? null,
  });
}

export async function getPendingNotifications(db: Database, userId: number) {
  return db
    .select()
    .from(pendingNotifications)
    .where(eq(pendingNotifications.userId, userId));
}

export async function markNotificationSent(db: Database, notificationId: number) {
  await db
    .update(pendingNotifications)
    .set({ sentAt: new Date() })
    .where(eq(pendingNotifications.id, notificationId));
}

// ============================================================
// Sent reminders (deduplication)
// ============================================================
export async function hasReminderBeenSent(
  db: Database,
  userId: number,
  reminderKey: string,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(sentReminders)
    .where(and(eq(sentReminders.userId, userId), eq(sentReminders.reminderKey, reminderKey)))
    .limit(1);
  return rows.length > 0;
}

export async function markReminderSent(db: Database, userId: number, reminderKey: string) {
  await db.insert(sentReminders).values({ userId, reminderKey });
}

export async function cleanOldReminders(db: Database, olderThanHours = 48) {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  await db.delete(sentReminders).where(lt(sentReminders.sentAt, cutoff));
}
