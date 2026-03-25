import { eq, and, gte } from "drizzle-orm";
import type { Database } from "../client.js";
import {
  userPowerStates,
  powerHistory,
  outageHistory,
  pingErrorAlerts,
} from "../schema.js";

// ============================================================
// User power states (for power monitor persistence)
// ============================================================
export async function getAllPowerStates(db: Database) {
  return db.select().from(userPowerStates);
}

export async function upsertPowerState(
  db: Database,
  telegramId: string,
  data: {
    routerIp?: string | null;
    powerState?: string | null;
    lastCheckedAt?: Date | null;
    lastChangedAt?: Date | null;
  },
) {
  await db
    .insert(userPowerStates)
    .values({
      telegramId,
      routerIp: data.routerIp ?? null,
      powerState: data.powerState ?? null,
      lastCheckedAt: data.lastCheckedAt ?? null,
      lastChangedAt: data.lastChangedAt ?? null,
    })
    .onConflictDoUpdate({
      target: userPowerStates.telegramId,
      set: data,
    });
}

export async function deletePowerState(db: Database, telegramId: string) {
  await db.delete(userPowerStates).where(eq(userPowerStates.telegramId, telegramId));
}

// ============================================================
// Power history
// ============================================================
export async function addPowerHistoryEntry(
  db: Database,
  userId: number,
  state: string,
) {
  await db.insert(powerHistory).values({ userId, state });
}

// ============================================================
// Outage history
// ============================================================
export async function startOutage(
  db: Database,
  userId: number,
  source: string,
) {
  await db.insert(outageHistory).values({
    userId,
    startedAt: new Date(),
    source,
  });
}

export async function endOutage(db: Database, outageId: number) {
  const [outage] = await db
    .select()
    .from(outageHistory)
    .where(eq(outageHistory.id, outageId))
    .limit(1);

  if (outage === undefined) return null;

  const durationMs = Date.now() - outage.startedAt.getTime();
  const durationMinutes = Math.round(durationMs / 60_000);

  const [updated] = await db
    .update(outageHistory)
    .set({ endedAt: new Date(), durationMinutes })
    .where(eq(outageHistory.id, outageId))
    .returning();

  return updated ?? null;
}

export async function getOutagesForWeek(db: Database, userId: number) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(outageHistory)
    .where(
      and(
        eq(outageHistory.userId, userId),
        gte(outageHistory.startedAt, weekAgo),
      ),
    );
}

// ============================================================
// Ping error alerts
// ============================================================
export async function addPingErrorAlert(
  db: Database,
  userId: number,
  errorMessage: string,
) {
  await db.insert(pingErrorAlerts).values({ userId, errorMessage });
}
