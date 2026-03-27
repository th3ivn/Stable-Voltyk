# Setup Guide

## Вимоги

- Node.js 20+
- npm
- Neon PostgreSQL database
- Telegram Bot Token

## Локальний запуск

```bash
# Встановити залежності
npm install

# Скопіювати env
cp .env.example .env

# Заповнити змінні в .env
# BOT_TOKEN=...
# DATABASE_URL=...

# Запустити міграції
npm run db:migrate

# Запустити в dev режимі (long polling)
npm run dev
```

## Змінні середовища

| Змінна | Обов'язкова | Опис |
|--------|-------------|------|
| `BOT_TOKEN` | ✅ | Telegram bot token |
| `DATABASE_URL` | ✅ | Neon PostgreSQL URL |
| `WEBHOOK_URL` | prod | URL для webhook |
| `WEBHOOK_SECRET` | prod | Секрет для webhook |
| `SENTRY_DSN` | рекомендовано | Sentry DSN |
| `GITHUB_TOKEN` | ні | GitHub API token |
| `OWNER_ID` | рекомендовано | Telegram ID власника |
| `ADMIN_IDS` | рекомендовано | Comma-separated admin IDs |

## Деплой на Railway

1. Push код на GitHub
2. Підключити репозиторій до Railway
3. Додати env змінні
4. Railway автоматично збере Docker image та задеплоє

## Команди

```bash
npm run dev          # Dev режим (tsx watch)
npm run build        # Production build
npm run start        # Запустити production
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run test         # Vitest тести
npm run db:generate  # Генерувати міграції
npm run db:migrate   # Застосувати міграції
npm run db:studio    # Drizzle Studio
```
