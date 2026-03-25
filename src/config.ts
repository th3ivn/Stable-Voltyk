import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().optional(),
  OWNER_ID: z.coerce.number().optional(),
  ADMIN_IDS: z
    .string()
    .default("")
    .transform((s) => (s.length > 0 ? s.split(",").map(Number) : [])),
  TZ: z.string().default("Europe/Kyiv"),
  PORT: z.coerce.number().default(3000),
  USE_WEBHOOK: z
    .string()
    .default("true")
    .transform((s) => s === "true"),
  WEBHOOK_URL: z.string().default(""),
  WEBHOOK_PATH: z.string().default("/webhook"),
  WEBHOOK_SECRET: z.string().default(""),
  SCHEDULE_CHECK_INTERVAL_S: z.coerce.number().default(60),
  POWER_CHECK_INTERVAL_S: z.coerce.number().default(0),
  POWER_DEBOUNCE_MINUTES: z.coerce.number().default(5),
  POWER_PING_TIMEOUT_MS: z.coerce.number().default(3000),
  POWER_MAX_CONCURRENT_PINGS: z.coerce.number().default(200),
  DATA_URL_TEMPLATE: z
    .string()
    .default(
      "https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/{region}.json",
    ),
  IMAGE_URL_TEMPLATE: z
    .string()
    .default(
      "https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/{region}/gpv-{queue}-emergency.png",
    ),
  SUPPORT_CHANNEL_URL: z.string().default(""),
  FAQ_CHANNEL_URL: z.string().default(""),
  GITHUB_TOKEN: z.string().default(""),
  SENTRY_DSN: z.string().default(""),
  ENVIRONMENT: z.enum(["production", "staging", "development"]).default("production"),
});

export type EnvConfig = z.infer<typeof envSchema>;

function parseEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
  return result.data;
}

export const config = parseEnv();

export const allAdminIds: number[] = [
  ...(config.OWNER_ID !== undefined ? [config.OWNER_ID] : []),
  ...config.ADMIN_IDS,
].filter((id, index, arr) => arr.indexOf(id) === index);

export function isAdmin(telegramId: number): boolean {
  return allAdminIds.includes(telegramId);
}

export function isOwner(telegramId: number): boolean {
  return config.OWNER_ID === telegramId;
}
