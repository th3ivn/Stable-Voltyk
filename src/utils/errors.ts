export enum ErrorCode {
  // User errors
  INVALID_IP = "INVALID_IP",
  INVALID_REGION = "INVALID_REGION",
  INVALID_QUEUE = "INVALID_QUEUE",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  REGISTRATION_DISABLED = "REGISTRATION_DISABLED",

  // External API errors
  GITHUB_API_ERROR = "GITHUB_API_ERROR",
  GITHUB_RATE_LIMITED = "GITHUB_RATE_LIMITED",
  TELEGRAM_RATE_LIMITED = "TELEGRAM_RATE_LIMITED",
  TELEGRAM_BLOCKED = "TELEGRAM_BLOCKED",
  TELEGRAM_CHAT_NOT_FOUND = "TELEGRAM_CHAT_NOT_FOUND",

  // Internal errors
  DB_CONNECTION_ERROR = "DB_CONNECTION_ERROR",
  DB_QUERY_ERROR = "DB_QUERY_ERROR",
  SCHEDULE_PARSE_ERROR = "SCHEDULE_PARSE_ERROR",
  PING_TIMEOUT = "PING_TIMEOUT",
  CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN",

  // Unexpected
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    context?: Record<string, unknown>,
    isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.context = context;
    this.isOperational = isOperational;
  }
}

export class CircuitBreakerOpenError extends AppError {
  constructor(serviceName: string) {
    super(
      ErrorCode.CIRCUIT_BREAKER_OPEN,
      `Circuit breaker is open for service: ${serviceName}`,
      { serviceName },
    );
    this.name = "CircuitBreakerOpenError";
  }
}
