import pino from "pino";

const isProduction = process.env["ENVIRONMENT"] !== "development";

export const logger = pino({
  level: isProduction ? "info" : "debug",
  transport: !isProduction
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: {
    service: "voltyk-bot",
    environment: process.env["ENVIRONMENT"] ?? "production",
  },
});

export type Logger = pino.Logger;
