import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/helpers.js";
import { AppError, ErrorCode } from "../utils/errors.js";

neonConfig.fetchConnectionCache = true;

export type Database = ReturnType<typeof createDrizzle>;

function createDrizzle(connectionString: string) {
  const sql = neon(connectionString);
  return drizzle(sql, { schema });
}

export async function createDbConnection(
  connectionString: string,
  maxRetries = 5,
): Promise<Database> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const db = createDrizzle(connectionString);
      // Test connection
      await db.execute("SELECT 1");
      logger.info("Database connected successfully");
      return db;
    } catch (error) {
      logger.warn({ attempt, maxRetries, error }, "DB connection failed, retrying...");
      if (attempt === maxRetries) {
        throw new AppError(
          ErrorCode.DB_CONNECTION_ERROR,
          `Failed to connect to database after ${maxRetries} attempts`,
          { error: String(error) },
          false,
        );
      }
      await sleep(1000 * Math.pow(2, attempt - 1));
    }
  }
  // Unreachable but satisfies TypeScript
  throw new AppError(ErrorCode.DB_CONNECTION_ERROR, "Failed to connect to database");
}

export async function checkDatabaseHealth(
  db: Database,
): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await db.execute("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
