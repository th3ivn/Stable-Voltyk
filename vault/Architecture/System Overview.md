# System Overview

## Архітектура

```
Telegram API
     │
     ▼
[Webhook /webhook]
     │
     ▼
[grammY Bot]
     │
     ├── Middleware Stack
     │   ├── requestId
     │   ├── sentry
     │   ├── db inject
     │   ├── maintenance check
     │   └── throttle (Token Bucket)
     │
     ├── Handlers
     │   ├── /start (wizard)
     │   ├── Main menu
     │   ├── Settings
     │   ├── Channel
     │   └── Admin
     │
     └── Services
         ├── API Service ──► GitHub Raw
         ├── Power Monitor ──► Router IPs
         ├── Scheduler (croner)
         └── Retry Queue

[Neon PostgreSQL]
[Sentry]
[Railway Deploy]
```

## Потік запуску

1. Validate env config (zod)
2. Init Sentry
3. Connect DB (retry)
4. Run migrations
5. Startup self-test
6. Init bot + middleware
7. Start scheduler
8. Start power monitor (load state from DB)
9. Set webhook
10. Start HTTP server
11. Notify admins: "🟢 Bot started"

## Ключові паттерни

### Token Bucket (rate limiting)
- Per-user bucket для `schedule_check`
- Max 3 tokens, refill rate 0.1/сек

### Circuit Breaker
- GitHub API: 5 fails → open 60s
- Telegram API: 10 fails → open 30s

### Retry Queue
- Telegram 429/500 → exponential backoff
- Max 5 спроб: 1s, 2s, 4s, 8s, 16s

### Graceful Shutdown
SIGTERM → stop webhook → stop scheduler → stop monitor → flush Sentry → close DB → exit

## Пов'язані нотатки

- [[Architecture/Database Schema]]
- [[Dev/API Reference]]
