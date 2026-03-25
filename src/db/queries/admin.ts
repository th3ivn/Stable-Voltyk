import { eq, sql, isNotNull, and } from "drizzle-orm";
import type { Database } from "../client.js";
import { users, userChannelConfig, pauseLog } from "../schema.js";

export async function getUserStats(db: Database) {
  const allUsers = await db.select().from(users);
  const totalUsers = allUsers.length;
  const activeUsers = allUsers.filter((u) => u.isActive).length;
  const blockedUsers = allUsers.filter((u) => u.isBlocked).length;
  const usersWithIp = allUsers.filter((u) => u.routerIp != null && u.routerIp.length > 0).length;

  // Region breakdown
  const regionCounts = new Map<string, number>();
  for (const u of allUsers) {
    if (u.isActive) {
      regionCounts.set(u.region, (regionCounts.get(u.region) ?? 0) + 1);
    }
  }
  const regionBreakdown = Array.from(regionCounts.entries())
    .map(([region, count]) => ({ region, count }))
    .sort((a, b) => b.count - a.count);

  // Users with channel
  const channelRows = await db
    .select()
    .from(userChannelConfig)
    .where(
      and(
        isNotNull(userChannelConfig.channelId),
        sql`length(${userChannelConfig.channelId}) > 0`,
      ),
    );
  const usersWithChannel = channelRows.length;

  return {
    totalUsers,
    activeUsers,
    blockedUsers,
    usersWithIp,
    usersWithChannel,
    regionBreakdown,
  };
}

export async function getActiveUserTelegramIds(db: Database): Promise<string[]> {
  const rows = await db
    .select({ telegramId: users.telegramId })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.isBlocked, false)));
  return rows.map((r) => r.telegramId);
}

export async function addPauseLogEntry(
  db: Database,
  adminId: number,
  action: "pause" | "resume",
  reason?: string,
) {
  await db.insert(pauseLog).values({ adminId, action, reason });
}
