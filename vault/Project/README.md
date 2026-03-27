# Вольтик (Stable-Voltyk)

> Telegram-бот для моніторингу відключень електроенергії в Україні

## Стек

| Компонент | Технологія |
|-----------|-----------|
| Runtime | Node.js 20 + TypeScript 5 |
| Bot Framework | grammY |
| ORM | Drizzle ORM |
| Database | Neon PostgreSQL |
| Scheduler | croner |
| Logger | pino |
| Deploy | Railway (Docker) |

## Структура проекту

```
src/
├── index.ts          # Entry point
├── bot.ts            # Bot instance + middleware
├── config.ts         # Env validation (zod)
├── db/               # Schema, client, queries
├── handlers/         # Bot command/callback handlers
├── services/         # API, scheduler, power monitor
├── formatters/       # Message formatters
├── keyboards/        # Inline keyboards
├── middlewares/      # DB, throttle, maintenance
└── utils/            # Helpers, logger, errors
```

## Регіони

- **Київ** (`kyiv`)
- **Київщина** (`kyiv-region`)
- **Дніпропетровщина** (`dnipro`)
- **Одещина** (`odesa`)

## Пов'язані нотатки

- [[Architecture/System Overview]]
- [[Architecture/Database Schema]]
- [[Dev/Setup Guide]]
- [[Dev/API Reference]]
- [[Dev/Progress]]
