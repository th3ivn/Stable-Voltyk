# Промт для переписування Telegram-бота «Вольтик» з Python/Aiogram на TypeScript/grammY

## ✅ Прогрес реалізації

| Крок | Опис | Статус |
|------|------|--------|
| 1 | Project scaffolding (package.json, tsconfig, eslint, prettier, vitest, структура папок) | ✅ Done |
| 2 | Config + Logger + Error types + Helpers (config.ts, logger.ts, errors.ts, helpers.ts + тести) | ✅ Done |
| 3 | Database schema + connection (22 таблиці Drizzle, Neon client з retry, migrate.ts, перша міграція) | ✅ Done |
| 4 | Database queries (users CRUD, settings k/v, schedule checks/snapshots/reminders, power states/history) | ✅ Done |
| 5 | Constants + Keyboards + Formatters (emoji IDs, regions, всі inline keyboards, всі тексти повідомлень) | ✅ Done |
| 6 | Bot instance + Middleware + /start wizard (bot.ts, session, throttle, maintenance, повний wizard flow, main menu) | ✅ Done |
| 7 | Main menu + Schedule + Timer + Stats + Help handlers | ✅ Done |
| 8 | Settings handlers (region, alerts, IP, channel, cleanup, data) | ✅ Done |
| 9 | Channel handlers (connect, format, notifications, pause, test, branding) | ✅ Done |
| 10 | Admin handlers (panel, broadcast, growth, intervals, maintenance, pause) | ✅ Done |
| 11 | API Service (GitHub fetch, schedule parsing, cache, circuit breaker) | ✅ Done |
| 12 | Power Monitor (IP ping, debounce, state management, notifications) | ✅ Done |
| 13 | Scheduler (croner jobs, schedule checks, reminders, cleanup) | ⬜ |
| 14 | Retry Queue + Branding (Telegram message retry, channel branding) | ⬜ |
| 15 | Entry point + Startup sequence (повний startup flow, graceful shutdown) | ⬜ |
| 16 | Metrics + Health + Admin notifications | ⬜ |
| 17 | Docker + Railway + CI (Dockerfile, railway.json, GitHub Actions) | ⬜ |
| 18 | Final testing + Polish | ⬜ |

---

## Мета

Переписати Telegram-бота **«Вольтик» (Voltyk)** з Python (Aiogram 3 + SQLAlchemy + Alembic + PostgreSQL) на **TypeScript** зі стеком:

- **grammY** — Telegram Bot Framework
- **Drizzle ORM** — типізований ORM
- **Neon** — Serverless PostgreSQL (через `@neondatabase/serverless` або стандартний `pg`)
- **Drizzle Kit** — міграції

**Критична вимога:** Всі екрани (тексти, кнопки, анімовані емодзі, callback_data, flow навігації) мають бути відтворені **1:1**, щоб користувач не помітив різниці. Логіку під капотом переробити з нуля, використовуючи найкращі практики TypeScript/grammY ecosystem.

---

## Технічний стек нового бота

| Компонент | Технологія |
|-----------|-----------|
| Runtime | Node.js 20+ з TypeScript 5.x |
| Bot Framework | grammY (latest) |
| Bot Mode | **Webhook** (production) з fallback на Long Polling (dev) |
| ORM | Drizzle ORM |
| Database | Neon PostgreSQL (Serverless) |
| Міграції | Drizzle Kit (`drizzle-kit generate` / `drizzle-kit migrate`) |
| Сесії / FSM | `@grammyjs/conversations` або `@grammyjs/session` |
| Scheduler | `node-cron` або `croner` |
| HTTP client | `undici` або `fetch` (built-in Node 20) |
| HTTP server | `express` або `hono` (для webhook endpoint + health check) |
| Logger | `pino` |
| Validation | `zod` |
| Env config | `dotenv` + `zod` schema validation |
| Error tracking | **Sentry** (`@sentry/node`) |
| Deploy | **Railway** (Docker) |

---

## Архітектура проєкту (рекомендована структура)

```
src/
├── index.ts                  # Entry point
├── bot.ts                    # Bot instance, middleware setup
├── config.ts                 # Env validation via zod
├── db/
│   ├── schema.ts             # Drizzle schema (всі таблиці)
│   ├── client.ts             # Neon/Drizzle connection
│   ├── queries/              # Query functions (users, settings, etc.)
│   └── migrate.ts            # Migration runner
├── handlers/
│   ├── start.ts              # /start command + wizard flow
│   ├── menu.ts               # Main menu, schedule, timer, stats, help
│   ├── settings/
│   │   ├── region.ts
│   │   ├── alerts.ts
│   │   ├── ip.ts
│   │   ├── channel.ts
│   │   ├── cleanup.ts
│   │   └── data.ts
│   ├── channel/
│   │   ├── connect.ts
│   │   ├── conversation.ts
│   │   ├── format.ts
│   │   ├── notifications.ts
│   │   ├── pause.ts
│   │   ├── settings.ts
│   │   ├── test.ts
│   │   └── branding.ts
│   ├── admin/
│   │   ├── panel.ts
│   │   ├── broadcast.ts
│   │   ├── growth.ts
│   │   ├── intervals.ts
│   │   ├── maintenance.ts
│   │   ├── pause.ts
│   │   └── database.ts
│   └── chat-member.ts
├── keyboards/
│   └── inline.ts             # ВСІ клавіатури (1:1 з Python версією)
├── constants/
│   └── regions.ts            # Регіони та черги
├── formatters/
│   ├── messages.ts           # format_main_menu_message, format_live_status_message, etc.
│   ├── schedule.ts           # format_schedule_message
│   ├── timer.ts              # format_timer_popup
│   └── template.ts           # format_template
├── services/
│   ├── api.ts                # Fetch schedule data & images from GitHub
│   ├── power-monitor.ts      # IP ping monitoring
│   ├── scheduler.ts          # Cron jobs
│   └── branding.ts           # Channel branding
├── middlewares/
│   ├── db.ts                 # DB session middleware
│   ├── throttle.ts           # Rate limiting
│   └── maintenance.ts        # Maintenance mode
├── states/                   # FSM states (conversations)
│   └── index.ts
└── utils/
    ├── helpers.ts
    ├── html-to-entities.ts
    └── logger.ts
```

---

## Регіони та черги

```typescript
interface Region {
  code: string;
  name: string;
}

const REGIONS: Record<string, Region> = {
  "kyiv": { code: "kyiv", name: "Київ" },
  "kyiv-region": { code: "kyiv-region", name: "Київщина" },
  "dnipro": { code: "dnipro", name: "Дніпропетровщина" },
  "odesa": { code: "odesa", name: "Одещина" },
};

// Стандартні черги: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 6.2
// Київ додатково: 7.1, 8.1, ..., 60.1
```

---

## База даних — Drizzle Schema

Відтворити наступні таблиці (використовуючи Drizzle ORM синтаксис):

### users
| Поле | Тип | Примітки |
|------|-----|----------|
| id | serial PK | |
| telegram_id | varchar(64) | unique, not null, indexed |
| username | varchar(255) | nullable |
| region | varchar(64) | not null |
| queue | varchar(16) | not null |
| router_ip | varchar(255) | nullable |
| is_active | boolean | default true |
| is_blocked | boolean | default false |
| last_menu_message_id | integer | nullable |
| created_at | timestamp | default now() |
| updated_at | timestamp | default now(), onUpdate |

### user_notification_settings
| Поле | Тип | Default |
|------|-----|---------|
| user_id | FK → users.id (PK) | CASCADE delete |
| notify_schedule_changes | boolean | true |
| notify_remind_off | boolean | true |
| notify_fact_off | boolean | true |
| notify_remind_on | boolean | true |
| notify_fact_on | boolean | true |
| remind_15m | boolean | true |
| remind_30m | boolean | false |
| remind_1h | boolean | false |
| notify_schedule_target | varchar(16) | "bot" |
| notify_remind_target | varchar(16) | "bot" |
| notify_power_target | varchar(16) | "bot" |
| auto_delete_commands | boolean | false |
| auto_delete_bot_messages | boolean | false |

### user_channel_config
| Поле | Тип | Default |
|------|-----|---------|
| user_id | FK → users.id (PK) | CASCADE delete |
| channel_id | varchar(64) | nullable |
| channel_title | varchar(255) | nullable |
| channel_description | text | nullable |
| channel_photo_file_id | varchar(255) | nullable |
| channel_user_title | varchar(255) | nullable |
| channel_user_description | text | nullable |
| channel_status | varchar(32) | "active" |
| channel_paused | boolean | false |
| channel_branding_updated_at | timestamp | nullable |
| channel_guard_warnings | integer | 0 |
| last_published_hash | varchar(128) | nullable |
| last_post_id | integer | nullable |
| last_schedule_message_id | integer | nullable |
| last_power_message_id | integer | nullable |
| schedule_caption | text | nullable |
| period_format | text | nullable |
| power_off_text | text | nullable |
| power_on_text | text | nullable |
| delete_old_message | boolean | false |
| picture_only | boolean | false |
| ch_notify_schedule | boolean | true |
| ch_notify_remind_off | boolean | true |
| ch_notify_remind_on | boolean | true |
| ch_notify_fact_off | boolean | true |
| ch_notify_fact_on | boolean | true |
| ch_remind_15m | boolean | true |
| ch_remind_30m | boolean | false |
| ch_remind_1h | boolean | false |

### user_power_tracking
| Поле | Тип |
|------|-----|
| user_id | FK → users.id (PK) |
| power_state | varchar(16) nullable |
| power_changed_at | timestamptz nullable |
| pending_power_state | varchar(16) nullable |
| pending_power_change_at | timestamptz nullable |
| last_power_state | varchar(16) nullable |
| last_power_change | integer nullable |
| power_on_duration | integer nullable |
| last_alert_off_period | varchar(64) nullable |
| last_alert_on_period | varchar(64) nullable |
| alert_off_message_id | integer nullable |
| alert_on_message_id | integer nullable |
| last_ping_error_at | timestamptz nullable |
| bot_power_message_id | bigint nullable |
| ch_power_message_id | bigint nullable |
| power_message_type | varchar(16) nullable |

### Додаткові таблиці
- **user_message_tracking** — tracking message IDs
- **settings** — key/value store
- **tickets** + **ticket_messages** — support tickets
- **outage_history**, **power_history**, **schedule_history** — історія
- **schedule_checks** — останні перевірки графіку (region+queue PK)
- **schedule_daily_snapshots** — щоденні знімки графіку
- **pending_notifications** — черга сповіщень
- **ping_error_alerts** — помилки пінгу
- **sent_reminders** — дедуплікація нагадувань
- **user_power_states** — стан живлення (telegram_id PK)
- **pending_channels** — канали що очікують підтвердження
- **pause_log** — лог паузи бота
- **admin_routers** — роутери адмінів
- **admin_router_history** — історія роутерів адмінів
- **admin_ticket_reminders** — нагадування про тікети

---

## Анімовані емодзі (Custom Emoji IDs)

**КРИТИЧНО: Всі animated custom emoji IDs мають бути збережені 1:1.**

```typescript
export const EMOJI = {
  SCHEDULE: "5210956306952758910",
  HELP: "5443038326535759644",
  STATS: "5190806721286657692",
  TIMER: "5382194935057372936",
  SETTINGS: "5341715473882955310",
  RESUME: "5348125953090403204",
  PAUSE_CHANNEL: "5359543311897998264",
  REGION: "5399898266265475100",
  REFRESH: "5017470156276761427",
  IP: "5447410659077661506",
  CHANNEL: "5424818078833715060",
  ALERTS: "5458603043203327669",
  ADMIN: "5217822164362739968",
  DELETE_DATA: "5445267414562389170",
  SCHEDULE_CHANGES: "5231200819986047254",
  BOT_NOTIF: "5372981976804366741",
  FACT: "5382194935057372936",
  CONFIRM_CHANGE: "5206607081334906820",
  CANCEL: "5210952531676504517",
  WELCOME: "5472055112702629499",
  CHECK: "5870509845911702494",
  WARN: "5447644880824181073",
  QUEUE: "5390854796011906616",
  BELL: "5262598817626234330",
  HOURGLASS: "5451732530048802485",
  IP_SETTINGS: "5312532335042794821",
  IP_ADDR: "5312283536177273995",
  ONLINE: "5309771882252243514",
  OFFLINE: "5312380297495484470",
  CHANGE_IP: "5312336892555990307",
  DELETE_IP: "5312141591803109522",
  PING_CHECK: "5312535839736111416",
  PING_LOADING: "5890925363067886150",
  SUCCESS: "5264973221576349285",
  ERROR_PING: "5312438206539536342",
  PING_FAIL: "5264933407229517572",
  SUPPORT: "5310296757320586255",
  REPLY: "5312237842020209022",
  INSTRUCTION: "5319069545850247853",
  INSTR_HELP: "5321151063095546482",
  FAQ: "5319180751143476261",
  NOTIF_SECTION: "5262598817626234330",
  CHANNEL_SECTION: "5312374181462055424",
  IP_SECTION: "5312283536177273995",
  SCHEDULE_SEC: "5264999721524562037",
  BOT_SETTINGS: "5312280340721604022",
  NEWS: "5312374181462055424",
  DISCUSS: "5312237842020209022",
} as const;
```

---

## Екрани (Flow) — повне відтворення 1:1

### 1. /start — Новий користувач (Wizard)

**Крок 1 — Регіон:**
```
👋 Вітаю! Я Вольтик ⚡

Слідкую за відключеннями світла і одразу
повідомлю, як тільки щось зміниться.

Налаштування займе ~1 хвилину.

📍 Крок 1 із 3 — Оберіть свій регіон:
```
Кнопки (2x2):
- `[Київ]` → `region_kyiv`
- `[Київщина]` → `region_kyiv-region`
- `[Дніпропетровщина]` → `region_dnipro`
- `[Одещина]` → `region_odesa`

**Крок 2 — Черга:**
```
✅ Регіон: {region_name}

⚡ Крок 2 із 3 — Оберіть свою чергу:
```
Кнопки: сітка черг (3 в ряд для стандартних, 4 в ряд для Києва з пагінацією).
- Для Києва: перша сторінка = стандартні черги + `[Інші черги →]` → `queue_page_2`
- Наступні сторінки: `[← Назад]` + `[Далі →]`

**Крок 3 — Куди сповіщення:**
```
✅ Черга: {queue}

📬 Крок 3 із 3 — Куди надсилати сповіщення?

📱 У цьому боті
Сповіщення приходитимуть прямо в цей чат

📺 У Telegram-каналі
Бот публікуватиме у ваш канал
(потрібно додати бота як адміністратора)
```
Кнопки:
- `[📱 У цьому боті]` → `wizard_notify_bot`
- `[📺 У Telegram-каналі]` → `wizard_notify_channel`

**Налаштування сповіщень бота (wizard):**
```
🔔 Налаштуйте сповіщення в боті:
```
Кнопки (toggle, стиль success/default):
- `[Оновлення графіків]` → `wizard_notif_toggle_schedule` (emoji: SCHEDULE_CHANGES)
- `[1 год]` `[30 хв]` `[15 хв]` → `wizard_notif_time_60/30/15`
- `[Фактично за IP-адресою]` → `wizard_notif_toggle_fact` (emoji: FACT)
- `[← Назад]` → `wizard_notify_back` + `[✓ Готово!]` → `wizard_bot_done`

**Wizard Done:**
```
✅ Готово!

📍 Регіон: {region_name}
⚡ Черга: {queue}
🔔 Сповіщення: увімкнено ✅

Я одразу повідомлю вас про наступне
відключення або появу світла.

⤵ Меню — перейти в головне меню
📢 Новини бота — канал з оновленнями
```
Кнопки:
- `[⤵ Меню]` → `back_to_main`
- `[📢 Новини бота]` → URL `https://t.me/Voltyk_news`

### 2. /start — Існуючий користувач
→ Показати головне меню (format_main_menu_message).

### 3. /start — Деактивований
```
👋 З поверненням!

Ваш профіль було деактивовано.

Оберіть опцію:
```
Кнопки:
- `[🔄 Відновити налаштування]` → `restore_profile`
- `[🆕 Почати заново]` → `create_new_profile`

### 4. /start — Реєстрація вимкнена
```
⚠️ Реєстрація тимчасово обмежена

На даний момент реєстрація нових користувачів тимчасово зупинена.

Спробуйте пізніше або зв'яжіться з підтримкою.
```

---

### 5. Головне меню (`back_to_main`)

Текст (format_main_menu_message):
```
🏠 Головне меню

📍 Регіон: {region_name} • {queue}
📺 Канал: {підключено ✅ | не підключено}
🔔 Сповіщення: {увімкнено ✅ | вимкнено}
```

Кнопки:
```
[Графік (📊 emoji)] [Допомога (❓ emoji)]
[Сповіщення (🔔 emoji)] [Канал (📺 emoji)]
[Налаштування (⚙️ emoji)]
// Якщо є канал:
[Тимчасово зупинити канал (⏸ emoji)]  // або "Відновити роботу каналу"
```
callback_data:
- `menu_schedule`, `menu_help`
- `settings_alerts`, `settings_channel`
- `menu_settings`
- `channel_pause` / `channel_resume`

---

### 6. Графік (`menu_schedule`)

Відображає фото графіку (schedule image) з caption (format_schedule_message).
Кнопки:
```
[Замінити (emoji: REGION)] [Перевірити (emoji: REFRESH)]
[⤴ Меню]
```
callback_data: `my_queues`, `schedule_check`, `back_to_main`

**schedule_check** — cooldown (default 30s), force refresh, порівняння hash, popup:
- `"💡 Знайдено зміни — оновлено"` або `"✅ Без змін — дані актуальні"`
- Cooldown popup: `"⏳ Зачекай ще {N} сек"`

---

### 7. Таймер (`menu_timer`) — show_alert popup

Popup з format_timer_popup:
- Якщо немає подій: `"🎉 Сьогодні без відключень!"` + завтра
- Якщо зараз світло є: `"За графіком зараз:\n🟢 Світло зараз є\n\n⏳ Вимкнення через {time}\n📅 Очікуємо - {start}–{end}"`
- Якщо зараз світла немає: `"За графіком зараз:\n🔴 Світла немає\n\n⏳ До увімкнення {time}\n📅 Поточне - {start}–{end}"`

---

### 8. Налаштування (`menu_settings`)

Текст (format_live_status_message):
```
📍 <b>{region_name} · {queue}</b>

📡 IP: {підключено ✅ | не підключено 😕}
📺 Канал: {підключено ✅ | не підключено}
🔔 Сповіщення: {увімкнено ✅ | вимкнено}

{💡 Додайте IP для моніторингу світла}  // якщо немає IP
{✅ Моніторинг активний}                 // якщо є IP + сповіщення
```

Кнопки:
```
[Регіон (emoji)] [IP (emoji)]
[Канал (emoji)] [Сповіщення (emoji)]
[🗑 Очищення]
[Адмін-панель (emoji)]  // тільки для адмінів
[Видалити мої дані (emoji)]
[⤴ Меню]
```

---

### 9. Сповіщення (`settings_alerts`)

**Без каналу:** Показати `build_notification_settings_message` + кнопки toggle.

**З каналом:** Спочатку вибір:
```
🔔 Керування сповіщеннями

Оберіть, що хочете налаштувати:
```
Кнопки:
- `[Сповіщення в боті]` → `notif_select_bot`
- `[Сповіщення для каналу]` → `notif_select_channel`
- `[← Назад]` → `back_to_main`

**build_notification_settings_message:**
```
<tg-emoji emoji-id="5262598817626234330">🔔</tg-emoji> Керування сповіщеннями

<tg-emoji emoji-id="5231200819986047254">📈</tg-emoji> Оновлення графіків — {✅|❌}

<tg-emoji emoji-id="5451732530048802485">⏳</tg-emoji> Нагадування про події перед (вимкнення / відновлення):
├ За 1 год — {✅|❌}
├ За 30 хв — {✅|❌}
├ За 15 хв — {✅|❌}
└ Фактично за IP-адресою — {✅|❌}

<i>Нагадування перед відкл. — {✅|❌} · перед вкл. — {✅|❌}</i>
```

---

### 10. IP моніторинг (`settings_ip`)

**Без IP (Екран 1А):**
```
<tg-emoji emoji-id="5312532335042794821">⚙️</tg-emoji> Налаштування моніторингу світла

Бот визначає статус світла у вас вдома — пінгуючи ваш роутер. ...

Варіант 1 — Статична (біла) IP-адреса
...
Варіант 2 — DDNS (якщо немає статичного IP)
...

Приклади вводу:
192.168.1.1
192.168.1.1:80
myhome.ddns.net

Введіть вашу IP-адресу або DDNS:
```
Кнопка: `[Скасувати]` (стиль danger) → `ip_cancel_to_settings`

**З IP (Екран 1Б) — з live-пінгом:**
```
<tg-emoji>⚙️</tg-emoji> IP моніторинг

<tg-emoji>📡</tg-emoji> IP: {router_ip}
Статус: Перевіряю <tg-emoji>⏳</tg-emoji>
```
→ оновлюється на `🟢 Онлайн` або `🔴 Офлайн`

Кнопки:
```
[Змінити IP (emoji)] [Видалити IP (emoji)]
[Перевірити пінг (emoji)]
[← Назад] [⤴ Меню]
```

---

### 11. Допомога (`menu_help`)

```
❓ Допомога

Тут ви можете дізнатися як користуватися
ботом або звернутися за підтримкою.
```
Кнопки:
```
[Інструкція (emoji)]
[FAQ (emoji)] [Підтримка (emoji)]
[Новини ↗ (URL)] [Обговорення ↗ (URL)]
[⤴ Меню]
```

**Інструкція → 6 розділів:** Регіон і черга, Сповіщення, Канал, IP моніторинг, Графік відключень, Налаштування бота. Кожен зі своїм довгим текстом + `tg-emoji`. (Всі тексти є в коді вище.)

**FAQ:**
```
<tg-emoji emoji-id="5319180751143476261">❓</tg-emoji> FAQ

Тут ви знайдете відповіді на найпоширеніші
питання про роботу бота.
```

**Підтримка:**
```
<tg-emoji emoji-id="5310296757320586255">💬</tg-emoji> Служба підтримки

Натисніть кнопку нижче щоб написати
адміністратору напряму в Telegram.
Відповідь надійде найближчим часом.
```

---

### 12. Канал (`settings_channel`)

```
📺 Налаштування каналу
📺 Канал: {title} ✅   // якщо підключено
```
Кнопки (без каналу):
```
[✚ Підключити канал]
[← Назад] [⤴ Меню]
```
Кнопки (з каналом):
```
[📺 Відкрити канал (URL)]  // якщо публічний
[ℹ️ Інфо] [✏️ Назва]
[📝 Опис] [📋 Формат]
[🧪 Тест] [🔴 Вимкнути / ⚙️ Перепідключити]
[🔔 Сповіщення]
[← Назад] [⤴ Меню]
```

**Підключення каналу — інструкція:**
```
📺 <b>Підключення каналу</b>

Щоб бот міг публікувати графіки у ваш канал:

1️⃣ Відкрийте ваш канал у Telegram
2️⃣ Перейдіть у Налаштування → Адміністратори
3️⃣ Натисніть "Додати адміністратора"
4️⃣ Знайдіть бота: @{bot_username}
5️⃣ Увімкніть усі перемикачі

Після того як ви додасте бота — він знайде канал автоматично.
```

---

### 13. Статистика (`menu_stats`)

```
📊 Статистика
```
Кнопки:
```
[⚡ Відключення за тиждень]
[📡 Статус пристрою]
[⚙️ Мої налаштування]
[⤴ Меню]
```

**Відключення за тиждень (stats_week):**
```
⚡ Відключення за тиждень

📊 Кількість відключень: {N}
⏱ Загальний час без світла: {X}г {Y}хв
```
або: `"За останні 7 днів відключень не зафіксовано."`

---

### 14. Очищення (`settings_cleanup`)

```
🗑 Автоматичне очищення

⌨️ Команди: {увімкнено ✅ | вимкнено}
💬 Відповіді: {увімкнено ✅ | вимкнено}
```
Кнопки toggle:
- `[⌨️ Видаляти команди]` → `cleanup_toggle_commands`
- `[💬 Видаляти старі відповіді]` → `cleanup_toggle_messages`
- `[← Назад]` `[⤴ Меню]`

---

### 15. Видалення даних (`settings_delete_data`)

**Крок 1:**
```
⚠️ Увага

Видалити всі дані:
• Профіль та налаштування
• Канал та його налаштування
• Історію та статистику
• Сповіщення

Цю дію неможливо скасувати.
```
Кнопки: `[Скасувати]` `[Продовжити]`

**Крок 2:**
```
❗ Підтвердження

Видалити всі дані? Цю дію неможливо скасувати.
```
Кнопки: `[Ні]` `[Так, видалити]`

**Після видалення:**
```
Добре, домовились 🙂 Я видалив усі дані та відключив канал.

Якщо захочете повернутися — /start
```

---

### 16. Формат графіку (format_schedule_message)

```
<i>💡 Графік відключень <b>на сьогодні, {date} ({day_name}),</b> для черги {queue}:</i>

🪫 <b>{start} - {end} (~{duration})</b> {⚠️ якщо можливе} {🆕 якщо нове}
Загалом без світла:<b> ~{total}</b>
```

Або:
```
<tg-emoji emoji-id="5870509845911702494">✅</tg-emoji> Відключень не заплановано
```

---

### 17. Reminder keyboard

```
[Графік (emoji)] [Зрозуміло (emoji)]
```
callback_data: `reminder_show_schedule`, `reminder_dismiss`

---

### 18. Адмін-панель (`settings_admin` / `admin_menu`)

Кнопки:
```
[📊 Аналітика] [👥 Користувачі]
[📢 Розсилка]
[⚙️ Налаштування] [📡 Роутер]
[🔧 Тех. роботи]
[← Назад] [⤴ Меню]
```

*(Всі вкладені екрани адмін-панелі описані в keyboards/inline.py — Growth, Registration, Intervals, Pause, Maintenance, etc.)*

---

## Джерело даних (Data Source) — ЄДИНЕ

Бот отримує дані **виключно** з GitHub-репозиторію:
**https://github.com/Baskerville42/outage-data-ua**

### URL-и для отримання даних

**JSON дані (графіки):**
```
https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/data/{region}.json
```
Регіони: `kyiv`, `kyiv-region`, `dnipro`, `odesa`

**PNG зображення (візуалізації графіків):**
```
https://raw.githubusercontent.com/Baskerville42/outage-data-ua/main/images/{region}/gpv-{queue}-emergency.png
```
Приклад: `images/kyiv-region/gpv-1-2.png` = група GPV 1.2

### Формат JSON (data/{region}.json)

```typescript
interface RegionData {
  regionId: string;                    // "kyiv", "kyiv-region", "dnipro", "odesa"
  regionAffiliation: string;           // "м. Київ"
  lastUpdated: string;                 // ISO 8601: "2025-11-06T11:41:56.430Z"
  fact: {
    updateFact: string;                // "06.11.2025 09:09" (Europe/Kyiv)
    // ...дані фактичних/аварійних відключень по групах на сьогодні та завтра
  };
  preset: {
    updateFact: string;                // "04.11.2025 18:00"
    // ...дані планових відключень на тиждень для кожної групи (тижневий шаблон)
  };
  lastUpdateStatus: {
    status: "parsed" | "error";
    ok: boolean;
    code: number;                      // 200, 422, etc.
    message: string | null;
    at: string;                        // ISO 8601
    attempt: number;
  };
  meta: {
    schemaVersion: "1.0.0";
    contentHash: string;               // hash вмісту fact + preset
  };
}
```

**Важливо:**
- `preset` — планові відключення (тижневий шаблон). Зберігається «як є» від обленерго.
- `fact` — фактичні/аварійні відключення на сьогодні та завтра.
- При помилці парсингу оновлюється тільки `lastUpdateStatus`, старі `fact`/`preset` зберігаються.
- `meta.contentHash` — використовувати для порівняння змін.

### Перевірка оновлень (GitHub Commits API)

```
GET https://api.github.com/repos/Baskerville42/outage-data-ua/commits?per_page=1&path=data
```

- Використовувати `If-None-Match` з ETag для кешування (304 не витрачає rate limit).
- З `GITHUB_TOKEN`: 5000 req/hour. Без: 60 req/hour.
- Якщо є новий commit → force refresh JSON + images.
- Якщо 304 Not Modified → skip.

---

## Ключові сервіси (логіка під капотом)

### API Service (api.ts)
- Fetch schedule JSON та images з GitHub raw URLs (див. секцію "Джерело даних")
- GitHub Commits API для перевірки оновлень (з ETag кешуванням)
- In-memory кеш з TTL (2 хвилини, max 100 записів) — використати `Map` або `lru-cache`
- `parseScheduleForQueue(data, queue)` — витягнути події для черги з preset/fact
- `findNextEvent(scheduleData)` — знайти наступну подію (відключення або включення)
- `calculateScheduleHash(events)` — sha256 hash для порівняння змін

### Power Monitor (power-monitor.ts)
- HTTP ping роутерів користувачів через fetch/undici з timeout
- Debounce (налаштовується через settings: POWER_DEBOUNCE_MINUTES)
- Стан в пам'яті + persist в БД (user_power_states) — **при рестарті відновлювати з БД**
- Concurrent pings з p-limit або custom semaphore (POWER_MAX_CONCURRENT_PINGS)
- Сповіщення при зміні стану (on→off, off→on) з cooldown
- Ping error alerts (щоденні)
- **Покращення vs Python:** при рестарті не втрачати стан (завантажувати з БД)

### Scheduler (scheduler.ts)
- Перевірка графіків кожні N секунд (SCHEDULE_CHECK_INTERVAL_S)
- Перевірка IP кожні N секунд (POWER_CHECK_INTERVAL_S)
- Щоденне повідомлення о 06:00 Kyiv time
- Flush pending notifications о 06:00
- Нагадування за 15m/30m/1h перед подіями
- Прибирання старих sent_reminders (>48h)
- **Використати `croner`** — легковагий, timezone-aware cron scheduler

### Branding (branding.ts)
- Автоматичне оновлення назви/опису/фото каналу
- Префікс "⚡" для назви каналу
- Channel guard — перевірка що branding не змінено

---

## Sentry інтеграція

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: config.SENTRY_DSN,
  environment: config.ENVIRONMENT, // "production" | "staging" | "development"
  tracesSampleRate: 0.1,           // 10% performance traces
  integrations: [
    Sentry.httpIntegration(),
  ],
});
```

**Де відловлювати помилки:**
- Глобальний error handler у grammY (`bot.catch`)
- Кожен handler обгорнутий через middleware або `bot.catch`
- Power monitor — помилки пінгів
- Scheduler — помилки у cron jobs
- API service — помилки fetch
- Unhandled rejections та uncaught exceptions

**Sentry context:**
- `Sentry.setUser({ id: telegramId, username })` — при кожному запиті
- `Sentry.setTag("region", user.region)` — для фільтрації
- `Sentry.setTag("handler", handlerName)` — який handler впав
- `Sentry.addBreadcrumb(...)` — важливі дії (schedule check, ping result, etc.)

---

## Webhook + Health Check + Graceful Shutdown

### Webhook Setup (для Railway)

```typescript
import express from "express"; // або Hono
import { webhookCallback } from "grammy";

const app = express();

// Webhook endpoint з signature verification
app.use(
  "/webhook",
  webhookCallback(bot, "express", {
    secretToken: config.WEBHOOK_SECRET, // Перевірка X-Telegram-Bot-Api-Secret-Token
  })
);

// Health check endpoint
app.get("/health", async (req, res) => {
  const checks = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: await checkDatabaseConnection(), // ping DB
    scheduler: isSchedulerRunning(),
  };
  const isHealthy = checks.database && checks.scheduler;
  res.status(isHealthy ? 200 : 503).json(checks);
});

app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});
```

**Webhook signature verification** — обов'язково! grammY `webhookCallback` підтримує `secretToken` з коробки. При `setWebhook` передавати `secret_token`.

### Graceful Shutdown

```typescript
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // 1. Зупинити прийом нових webhook requests
  server.close();

  // 2. Зупинити scheduler (дочекатися поточних задач)
  await scheduler.stop();

  // 3. Зупинити power monitor
  await powerMonitor.stop();

  // 4. Flush Sentry events
  await Sentry.flush(5000);

  // 5. Закрити DB connection pool
  await db.end();

  // 6. Видалити webhook (опційно, щоб Telegram не слав requests на мертвий сервер)
  // await bot.api.deleteWebhook();

  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
```

**Railway:** SIGTERM надсилається при re-deploy або зупинці. Є 10 секунд grace period.

---

## Rate Limiting (Token Bucket)

Замість простого in-memory cooldown (як у Python-версії), використати **Token Bucket** алгоритм:

```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,    // наприклад 3
    private refillRate: number,   // tokens per second, наприклад 0.1 (1 token per 10s)
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  getWaitTime(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / this.refillRate * 1000);
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Використання: per-user bucket для schedule_check
const userBuckets = new Map<number, TokenBucket>();
```

**Переваги:**
- Не втрачається при рестарті (можна persist у Redis або просто recreate)
- Більш гнучкий — burst + sustained rate
- Для Telegram API rate limits — окремий global bucket (30 msg/sec)

---

## Railway Deploy

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### railway.json

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "dockerfilePath": "Dockerfile" },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 10,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

### Env Variables на Railway
```
BOT_TOKEN=...
DATABASE_URL=...            # Neon connection string
WEBHOOK_URL=https://your-app.up.railway.app
WEBHOOK_SECRET=...          # Random string для signature verification
SENTRY_DSN=...
GITHUB_TOKEN=...            # Опційно, для вищого rate limit
ENVIRONMENT=production
PORT=3000
```

---

## Конфігурація (config.ts)

```typescript
// Всі змінні оточення з Python-версії
const envSchema = z.object({
  BOT_TOKEN: z.string(),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),
  OWNER_ID: z.coerce.number().optional(),
  ADMIN_IDS: z.string().transform(s => s.split(',').map(Number)).default(''),
  TZ: z.string().default('Europe/Kyiv'),
  PORT: z.coerce.number().default(3000),
  USE_WEBHOOK: z.coerce.boolean().default(true),  // default true for Railway
  WEBHOOK_URL: z.string().default(''),
  WEBHOOK_PATH: z.string().default('/webhook'),
  WEBHOOK_SECRET: z.string().min(1, 'WEBHOOK_SECRET is required in production'),
  SCHEDULE_CHECK_INTERVAL_S: z.coerce.number().default(60),
  POWER_CHECK_INTERVAL_S: z.coerce.number().default(0),
  POWER_DEBOUNCE_MINUTES: z.coerce.number().default(5),
  POWER_PING_TIMEOUT_MS: z.coerce.number().default(3000),
  POWER_MAX_CONCURRENT_PINGS: z.coerce.number().default(200),
  DATA_URL_TEMPLATE: z.string().default('...'),
  IMAGE_URL_TEMPLATE: z.string().default('...'),
  SUPPORT_CHANNEL_URL: z.string().default(''),
  FAQ_CHANNEL_URL: z.string().default(''),
  GITHUB_TOKEN: z.string().default(''),
  SENTRY_DSN: z.string().default(''),
  ENVIRONMENT: z.string().default('production'),
});
```

---

## Middleware

1. **DB Middleware** — inject Drizzle db instance into context
2. **Throttle** — Token Bucket rate limiting per user
3. **Maintenance** — якщо бот на паузі, відповідати повідомленням maintenance
4. **Request ID** — генерувати унікальний `requestId` для кожного update, додавати в logger context
5. **Sentry** — `Sentry.setUser()`, `Sentry.setTag()` для кожного запиту
6. **Error handler** — global `bot.catch()` з Sentry reporting + admin notification

---

## Retry Queue для Telegram повідомлень

При масовій розсилці (100+ юзерів) Telegram повертає 429 (Too Many Requests). Повідомлення не мають губитися.

```typescript
interface QueuedMessage {
  id: string;
  chatId: number;
  method: "sendMessage" | "sendPhoto" | "editMessageText";
  params: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;       // timestamp
  createdAt: number;
}

class TelegramRetryQueue {
  private queue: QueuedMessage[] = [];
  private processing = false;
  private readonly MAX_ATTEMPTS = 5;
  private readonly BASE_DELAY_MS = 1000;

  async enqueue(msg: Omit<QueuedMessage, "id" | "attempts" | "nextRetryAt" | "createdAt">) { ... }

  private getBackoffDelay(attempt: number): number {
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    return this.BASE_DELAY_MS * Math.pow(2, attempt);
  }

  private async processQueue() {
    // Process in order, respect Telegram rate limits (30 msg/sec)
    // On 429: re-enqueue with backoff
    // On 400 (chat not found, blocked): mark user as blocked in DB
    // On 5xx: retry with backoff
    // After MAX_ATTEMPTS: log to Sentry, notify admin
  }
}
```

**Критично для:** broadcast, schedule change notifications, reminder notifications.

---

## Database Connection Retry + Pool Health

```typescript
import { neon, neonConfig } from "@neondatabase/serverless";

neonConfig.fetchConnectionCache = true;

// Connection with retry
async function createDbConnection(maxRetries = 5): Promise<DrizzleInstance> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const sql = neon(config.DATABASE_URL);
      // Test connection
      await sql`SELECT 1`;
      logger.info("Database connected successfully");
      return drizzle(sql, { schema });
    } catch (error) {
      logger.warn({ attempt, maxRetries, error }, "DB connection failed, retrying...");
      if (attempt === maxRetries) throw error;
      await sleep(1000 * Math.pow(2, attempt - 1)); // exponential backoff
    }
  }
}

// Pool health check (for /health endpoint)
async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
```

---

## Circuit Breaker

Для зовнішніх API (GitHub, Telegram) — якщо сервіс лежить, не спамити запитами:

```typescript
enum CircuitState { CLOSED, OPEN, HALF_OPEN }

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold: number = 5,      // скільки помилок до OPEN
    private readonly resetTimeoutMs: number = 60_000,    // час у OPEN перед HALF_OPEN
    private readonly onOpen?: () => void,                // callback при відкритті (notify admin)
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new CircuitBreakerOpenError(this.name);
      }
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}

// Використання:
const githubCircuit = new CircuitBreaker("github", 5, 60_000, () => {
  notifyAdmins("⚠️ GitHub API circuit breaker OPEN — data source unavailable");
});

const telegramCircuit = new CircuitBreaker("telegram", 10, 30_000, () => {
  Sentry.captureMessage("Telegram API circuit breaker opened");
});
```

---

## Structured Error Codes

Замість generic `"Щось пішло не так"` — кожна помилка має код і context:

```typescript
enum ErrorCode {
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

class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly context?: Record<string, unknown>,
    public readonly isOperational = true,  // false = bug, true = expected error
  ) {
    super(message);
  }
}

// Використання:
throw new AppError(
  ErrorCode.GITHUB_API_ERROR,
  "Failed to fetch schedule data",
  { region: "kyiv", statusCode: 503, attempt: 3 }
);
```

---

## Метрики (/metrics endpoint)

```typescript
class Metrics {
  private counters = {
    messagesReceived: 0,
    messagesSent: 0,
    messagesFailed: 0,
    callbacksProcessed: 0,
    scheduleChecks: 0,
    scheduleChangesDetected: 0,
    pingChecks: 0,
    pingFailures: 0,
    errors: 0,
    retryQueueSize: 0,
  };
  private gauges = {
    activeUsers: 0,
    connectedChannels: 0,
    uptimeSeconds: 0,
    dbLatencyMs: 0,
  };
  private histograms = {
    handlerDurationMs: [] as number[],
  };

  increment(counter: keyof typeof this.counters, value = 1) { ... }
  setGauge(gauge: keyof typeof this.gauges, value: number) { ... }
  recordDuration(histogram: keyof typeof this.histograms, ms: number) { ... }

  toJSON() {
    return {
      counters: this.counters,
      gauges: {
        ...this.gauges,
        uptimeSeconds: process.uptime(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

// GET /metrics
app.get("/metrics", (req, res) => {
  res.json(metrics.toJSON());
});
```

---

## Startup Self-Test

При старті бота перевірити що все працює, перш ніж приймати трафік:

```typescript
async function startupSelfTest(): Promise<void> {
  const checks = [
    { name: "Database", fn: () => db.execute(sql`SELECT 1`) },
    { name: "Bot Token", fn: () => bot.api.getMe() },
    { name: "GitHub API", fn: () => fetch(DATA_URL_TEMPLATE.replace("{region}", "kyiv"), { method: "HEAD" }) },
    { name: "Sentry", fn: () => Sentry.captureMessage("Bot startup", "info") },
  ];

  logger.info("Running startup self-test...");
  for (const check of checks) {
    try {
      await check.fn();
      logger.info(`✅ ${check.name}: OK`);
    } catch (error) {
      logger.error({ error }, `❌ ${check.name}: FAILED`);
      throw new AppError(ErrorCode.UNKNOWN_ERROR, `Startup check failed: ${check.name}`);
    }
  }
  logger.info("All startup checks passed");
}
```

**Порядок запуску:**
1. Parse & validate env config
2. Init Sentry
3. Connect to DB (with retry)
4. Run DB migrations (auto)
5. Run startup self-test
6. Init bot instance + middleware
7. Start scheduler
8. Start power monitor (load state from DB)
9. Set webhook
10. Start HTTP server (webhook + health + metrics)
11. Notify admins: "🟢 Bot started"

---

## Admin Notifications в Telegram

При critical errors адмін одразу дізнається:

```typescript
async function notifyAdmins(message: string, level: "info" | "warn" | "error" = "error") {
  const emoji = { info: "ℹ️", warn: "⚠️", error: "🚨" };
  const text = `${emoji[level]} <b>Voltyk Bot</b>\n\n${message}\n\n<i>${new Date().toISOString()}</i>`;

  for (const adminId of config.allAdminIds) {
    try {
      await bot.api.sendMessage(adminId, text, { parse_mode: "HTML" });
    } catch (error) {
      logger.error({ adminId, error }, "Failed to notify admin");
    }
  }
}

// Коли надсилати:
// - Bot started / stopped
// - Circuit breaker opened/closed
// - DB connection lost/restored
// - GitHub API rate limited
// - Unhandled error in handler (з Sentry event ID)
// - Retry queue overflow (message dropped after MAX_ATTEMPTS)
// - Scheduler job failed
```

---

## Structured Logging з Request ID

```typescript
import pino from "pino";

const logger = pino({
  level: config.ENVIRONMENT === "production" ? "info" : "debug",
  transport: config.ENVIRONMENT !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: {
    service: "voltyk-bot",
    environment: config.ENVIRONMENT,
  },
});

// Middleware: attach requestId to each update
function requestIdMiddleware(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const requestId = crypto.randomUUID();
    ctx.requestId = requestId;
    ctx.logger = logger.child({
      requestId,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      updateType: ctx.updateType,
    });
    ctx.logger.info("Incoming update");
    const start = Date.now();
    try {
      await next();
    } finally {
      ctx.logger.info({ durationMs: Date.now() - start }, "Update processed");
    }
  };
}
```

**Формат логу (production, JSON):**
```json
{
  "level": "info",
  "time": 1711234567890,
  "service": "voltyk-bot",
  "requestId": "a1b2c3d4-...",
  "userId": 123456789,
  "updateType": "callback_query",
  "msg": "Incoming update"
}
```

---

## ESLint + Prettier

```json
// .eslintrc.json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "prettier"
  ],
  "parserOptions": {
    "project": "./tsconfig.json"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/strict-boolean-expressions": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

---

## Unit Tests (Vitest)

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
});
```

**Що тестувати (мінімум):**
- `parseScheduleForQueue()` — парсинг JSON → події для черги
- `findNextEvent()` — правильне визначення наступної події
- `calculateScheduleHash()` — стабільний hash
- `formatScheduleMessage()` — правильне форматування тексту
- `formatTimerPopup()` — всі варіації popup
- `formatMainMenuMessage()` — текст головного меню
- `isValidIpOrDomain()` — валідація IP/domain
- `TokenBucket` — rate limiting logic
- `CircuitBreaker` — state transitions

---

## GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint        # ESLint
      - run: npm run typecheck   # tsc --noEmit
      - run: npm run test        # Vitest
      - run: npm run build       # Ensure production build works
```

```json
// package.json scripts
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/ --ext .ts",
    "lint:fix": "eslint src/ --ext .ts --fix",
    "format": "prettier --write src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

## Automated DB Migrations on Deploy

В `src/index.ts` при старті автоматично запускати міграції:

```typescript
import { migrate } from "drizzle-orm/neon-serverless/migrator";

async function main() {
  // 1. Config
  const config = parseEnv();

  // 2. Sentry
  Sentry.init({ dsn: config.SENTRY_DSN, environment: config.ENVIRONMENT });

  // 3. DB connect (with retry)
  const db = await createDbConnection();

  // 4. Auto-migrate
  logger.info("Running database migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  logger.info("Migrations complete");

  // 5. Self-test
  await startupSelfTest();

  // 6. Bot setup...
}
```

**Railway:** при кожному deploy, спочатку мігрує БД, потім стартує бот. Якщо міграція впаде — deploy зафейлиться, Railway відкатить.

---

## Вимоги до якості коду

1. **Strict TypeScript** — `strict: true`, no `any`, no `@ts-ignore`
2. **Structured error handling** — `AppError` з `ErrorCode`, не просто try/catch
3. **"message is not modified"** — ігнорувати цю помилку при edit_text (grammY `GrammyError`)
4. **Connection pooling** — Neon serverless з retry + health monitoring
5. **Graceful shutdown** — cleanup на SIGTERM/SIGINT з proper ordering
6. **Structured logging** — pino з requestId, userId, updateType context
7. **Input validation** — zod для env, proper validation для IP, тощо
8. **No hardcoded strings** — всі тексти в окремих constants або inline (як в оригіналі)
9. **Proper FSM** — grammY conversations або session-based state machine
10. **Idempotent operations** — safe re-entry для всіх callback handlers
11. **Circuit Breaker** — для GitHub та Telegram API
12. **Retry Queue** — для Telegram повідомлень (429/500)
13. **Admin notifications** — при critical errors
14. **Metrics** — /metrics endpoint для моніторингу
15. **100% type safety** — всі DB queries typed через Drizzle schema inference

---

## Важливі деталі для відтворення

1. **Кнопки з custom emoji** — grammY підтримує `icon_custom_emoji_id` в `InlineKeyboardButton`
2. **Стилі кнопок** — `style: "success" | "danger" | "primary"` (grammY Bot API parameter)
3. **tg-emoji в тексті** — `<tg-emoji emoji-id="...">fallback</tg-emoji>` — підтримується через HTML parse_mode
4. **Пагінація черг** — сторінки для Київських черг (7.1–60.1)
5. **Photo + caption** — графік надсилається як фото з caption і entities
6. **show_alert: true** — для таймера використовується popup (не toast)
7. **edit_media** — для оновлення фото графіку без мигання

---

## Що НЕ потрібно копіювати з Python-версії

1. ❌ SQLAlchemy ORM → використати Drizzle
2. ❌ Alembic → використати Drizzle Kit
3. ❌ aiohttp → використати fetch/undici
4. ❌ aiogram Router/Filter → використати grammY router/filter
5. ❌ Redis для FSM → використати grammY sessions (in-memory або DB)
6. ❌ Костилі та workarounds з Python-версії
7. ❌ Баги та нестабільності оригіналу

---

## Відомі проблеми Python-версії (ОБОВ'ЯЗКОВО виправити)

1. **In-memory cooldown (`_user_last_check: dict`)** — при рестарті втрачається. → Використати Token Bucket з можливістю persist.
2. **In-memory power states (`_user_states: dict`)** — при краші всі стани губляться. → При старті завантажувати з БД (user_power_states).
3. **Немає retry logic для Telegram API** — одна помилка і повідомлення втрачене. → Retry Queue з exponential backoff.
4. **Відсутній health check** — Railway не знає чи бот живий. → `/health` endpoint.
5. **Race conditions у power monitor** — concurrent pings без proper locking. → Використати `p-limit` або semaphore.
6. **Немає graceful shutdown** — при рестарті втрачаються in-flight повідомлення. → Proper SIGTERM handling.
7. **Простий cooldown замість rate limiting** — нема burst protection. → Token Bucket.
8. **Webhook без signature verification** — будь-хто може слати fake updates. → WEBHOOK_SECRET обов'язковий.
9. **Немає structured logging** — складно дебажити production issues. → Pino з requestId.
10. **Немає circuit breaker** — якщо GitHub лежить, бот спамить запитами. → Circuit Breaker.

---

## ПОКРОКОВА ІНСТРУКЦІЯ для Claude Code

**ВАЖЛИВО:** Не робити все одразу! Розбити на кроки, кожен крок — окремий коміт. Перевіряти typecheck після кожного кроку.

### Фаза 1 — Фундамент (кроки 1–5)

**Крок 1: Project scaffolding**
- `npm init`, `tsconfig.json` (strict), `.eslintrc.json`, `.prettierrc`
- Встановити всі залежності: `grammy`, `drizzle-orm`, `@neondatabase/serverless`, `pino`, `zod`, `@sentry/node`, `express`, `croner`, `p-limit`
- Dev deps: `typescript`, `tsx`, `vitest`, `eslint`, `prettier`, `drizzle-kit`
- Створити структуру папок
- `npm run typecheck` має працювати

**Крок 2: Config + Logger + Error types**
- `src/config.ts` — zod env validation
- `src/utils/logger.ts` — pino setup
- `src/utils/errors.ts` — `AppError`, `ErrorCode` enum
- `src/utils/helpers.ts` — `sleep()`, `isValidIpOrDomain()`, утиліти
- Написати тести для helpers

**Крок 3: Database schema + connection**
- `src/db/schema.ts` — ВСІ таблиці через Drizzle (users, notification_settings, channel_config, power_tracking, etc.)
- `src/db/client.ts` — Neon connection з retry
- `drizzle.config.ts`
- `npm run db:generate` — перша міграція
- Перевірити що міграція проходить на порожній Neon DB

**Крок 4: Database queries**
- `src/db/queries/users.ts` — CRUD для users + related tables
- `src/db/queries/settings.ts` — key/value store
- `src/db/queries/schedule.ts` — schedule checks, snapshots, pending notifications
- `src/db/queries/power.ts` — power states, power history
- Написати тести для queries (mock DB або test DB)

**Крок 5: Constants + Keyboards + Formatters**
- `src/constants/regions.ts` — регіони та черги (1:1)
- `src/constants/emoji.ts` — ВСІ animated emoji IDs (1:1)
- `src/keyboards/inline.ts` — ВСІ клавіатури (1:1)
- `src/formatters/messages.ts` — format_main_menu, format_live_status, build_notification_settings
- `src/formatters/schedule.ts` — format_schedule_message
- `src/formatters/timer.ts` — format_timer_popup
- Написати тести для formatters
- `npm run typecheck` + `npm run test`

### Фаза 2 — Bot Handlers (кроки 6–10)

**Крок 6: Bot instance + Middleware + /start wizard**
- `src/bot.ts` — grammY Bot instance, context type, session setup
- `src/middlewares/` — db, throttle, requestId, maintenance, sentry
- `src/handlers/start.ts` — /start command + wizard (region → queue → notify target → notifications → done)
- FSM через `@grammyjs/conversations` або session
- Перевірити що wizard працює end-to-end

**Крок 7: Main menu + Schedule + Timer + Stats + Help**
- `src/handlers/menu.ts` — back_to_main, menu_schedule, schedule_check, menu_timer, menu_stats, menu_help
- Всі instruction screens (instr_region, instr_notif, instr_channel, instr_ip, instr_schedule, instr_bot_settings)
- FAQ, Support, Help keyboards
- Reminder keyboard (reminder_dismiss, reminder_show_schedule)

**Крок 8: Settings handlers**
- `src/handlers/settings/region.ts` — зміна регіону/черги
- `src/handlers/settings/alerts.ts` — сповіщення (toggle, targets, channel notifications)
- `src/handlers/settings/ip.ts` — IP моніторинг (input, ping, delete, change)
- `src/handlers/settings/channel.ts` — канал settings
- `src/handlers/settings/cleanup.ts` — auto-delete
- `src/handlers/settings/data.ts` — видалення даних, деактивація

**Крок 9: Channel handlers**
- `src/handlers/channel/connect.ts` — підключення каналу
- `src/handlers/channel/conversation.ts` — FSM для назви/опису каналу
- `src/handlers/channel/format.ts` — формат публікацій
- `src/handlers/channel/notifications.ts` — сповіщення каналу
- `src/handlers/channel/pause.ts` — пауза каналу
- `src/handlers/channel/test.ts` — тестові публікації
- `src/handlers/channel/branding.ts` — auto-branding
- `src/handlers/chat-member.ts` — обробка додавання бота в канал

**Крок 10: Admin handlers**
- `src/handlers/admin/panel.ts` — адмін панель, аналітика, users
- `src/handlers/admin/broadcast.ts` — розсилка (з Retry Queue!)
- `src/handlers/admin/growth.ts` — growth metrics, registration toggle
- `src/handlers/admin/intervals.ts` — schedule/IP інтервали, debounce, cooldown
- `src/handlers/admin/maintenance.ts` — тех. роботи
- `src/handlers/admin/pause.ts` — пауза бота

### Фаза 3 — Services (кроки 11–14)

**Крок 11: API Service**
- `src/services/api.ts` — fetch schedule JSON + images з GitHub
- GitHub Commits API перевірка з ETag
- In-memory cache з TTL
- `parseScheduleForQueue()`, `findNextEvent()`, `calculateScheduleHash()`
- Circuit Breaker для GitHub API
- Тести для парсингу

**Крок 12: Power Monitor**
- `src/services/power-monitor.ts` — HTTP ping з p-limit
- State management (in-memory + DB persist)
- Debounce logic
- Notifications (on→off, off→on)
- Ping error alerts
- Завантаження стану з DB при старті

**Крок 13: Scheduler**
- `src/services/scheduler.ts` — croner jobs
- Schedule check (кожні N секунд)
- IP ping check (кожні N секунд)
- Daily 06:00 notification (flush pending + daily planned)
- Reminders (15m, 30m, 1h)
- Cleanup old sent_reminders

**Крок 14: Retry Queue + Branding**
- `src/services/retry-queue.ts` — Telegram message retry queue
- `src/services/branding.ts` — channel branding + guard
- Інтеграція retry queue з broadcast та notifications

### Фаза 4 — Infrastructure (кроки 15–18)

**Крок 15: Entry point + Startup sequence**
- `src/index.ts` — повний startup flow:
  1. Config → 2. Sentry → 3. DB (with retry) → 4. Migrations → 5. Self-test → 6. Bot + middleware → 7. Scheduler → 8. Power monitor → 9. Webhook → 10. HTTP server → 11. Notify admins
- Graceful shutdown (SIGTERM/SIGINT)

**Крок 16: Metrics + Health + Admin notifications**
- `src/services/metrics.ts` — counters, gauges
- `/health` endpoint
- `/metrics` endpoint
- `notifyAdmins()` utility
- Circuit breaker → admin notification integration

**Крок 17: Docker + Railway + CI**
- `Dockerfile` (multi-stage build)
- `railway.json` (healthcheck, restart policy)
- `.github/workflows/ci.yml` (lint, typecheck, test, build)
- `.dockerignore`, `.gitignore`

**Крок 18: Final testing + Polish**
- End-to-end тест кожного screen flow
- Перевірити всі emoji IDs
- Перевірити всі callback_data
- Перевірити всі тексти 1:1
- Load test з кількома юзерами
- `npm run lint` — 0 errors
- `npm run typecheck` — 0 errors
- `npm run test` — all pass

---

## Підсумок

Цей промт містить повну специфікацію для створення production-ready Telegram бота «Вольтик» на TypeScript/grammY/Drizzle/Neon з деплоєм на Railway.

**Ключові аспекти:**
- Всі екрани, тексти, кнопки, анімовані емодзі та flow навігації — **1:1 з оригіналом**
- Єдине джерело даних — **Baskerville42/outage-data-ua** (GitHub)
- **Sentry** для error tracking
- **Webhook** з signature verification + health check + metrics endpoints
- **Graceful shutdown** для Railway з proper ordering
- **Token Bucket** rate limiting замість простого cooldown
- **Retry Queue** для Telegram повідомлень (429/500 handling)
- **Circuit Breaker** для GitHub та Telegram API
- **Structured errors** з ErrorCode enum
- **Structured logging** з pino + requestId tracing
- **Admin notifications** в Telegram при critical errors
- **Startup self-test** перед прийомом трафіку
- **ESLint + Prettier + Vitest + GitHub Actions CI**
- **Automated DB migrations** при deploy
- **18 покрокових кроків** для Claude Code — кожен крок = окремий коміт
- Всі відомі проблеми Python-версії виправлені
