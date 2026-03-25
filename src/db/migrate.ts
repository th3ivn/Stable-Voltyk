import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { logger } from "../utils/logger.js";

export async function runMigrations(connectionString: string): Promise<void> {
  logger.info("Running database migrations...");
  const sql = neon(connectionString);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  logger.info("Migrations complete");
}
