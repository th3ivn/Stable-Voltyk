# API Reference

## Джерело даних

Єдине джерело — GitHub репозиторій [Baskerville42/outage-data-ua](https://github.com/Baskerville42/outage-data-ua)

## Endpoints

### JSON дані (графіки)
```
GET https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/{region}.json
```

Регіони: `kyiv`, `kyiv-region`, `dnipro`, `odesa`

### PNG зображення
```
GET https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/{region}/gpv-{queue}-emergency.png
```

Приклад: `images/kyiv-region/gpv-1-2.png`

### GitHub Commits API (перевірка оновлень)
```
GET https://api.github.com/repos/Baskerville42/outage-data-ua/commits?per_page=1&path=data
```

- Використовувати `If-None-Match` + ETag для кешування
- 304 = без змін (не витрачає rate limit)

## Структура JSON

```typescript
interface RegionData {
  regionId: string;
  regionAffiliation: string;
  lastUpdated: string;          // ISO 8601
  fact: { ... };                // Фактичні відключення (сьогодні/завтра)
  preset: { ... };              // Планові відключення (тижневий шаблон)
  lastUpdateStatus: {
    status: "parsed" | "error";
    ok: boolean;
    code: number;
    message: string | null;
    at: string;
    attempt: number;
  };
  meta: {
    schemaVersion: "1.0.0";
    contentHash: string;
  };
}
```

## Rate Limits

| Метод | Без токена | З GITHUB_TOKEN |
|-------|-----------|----------------|
| GitHub API | 60 req/год | 5000 req/год |
| GitHub Raw | необмежено | необмежено |

## Endpoints бота

| Endpoint | Опис |
|----------|------|
| `POST /webhook` | Telegram webhook |
| `GET /health` | Health check |
| `GET /metrics` | Метрики |
