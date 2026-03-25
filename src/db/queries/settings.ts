import { eq } from "drizzle-orm";
import type { Database } from "../client.js";
import { settings } from "../schema.js";

export async function getSetting(db: Database, key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(db: Database, key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function deleteSetting(db: Database, key: string): Promise<void> {
  await db.delete(settings).where(eq(settings.key, key));
}

// Typed settings helpers
export async function getSettingBool(db: Database, key: string, defaultValue = false): Promise<boolean> {
  const val = await getSetting(db, key);
  if (val === null) return defaultValue;
  return val === "true" || val === "1";
}

export async function getSettingInt(db: Database, key: string, defaultValue = 0): Promise<number> {
  const val = await getSetting(db, key);
  if (val === null) return defaultValue;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultValue : num;
}
