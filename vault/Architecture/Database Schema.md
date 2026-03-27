# Database Schema

ORM: **Drizzle** | Database: **Neon PostgreSQL**

## Основні таблиці

### `users`
| Поле | Тип |
|------|-----|
| id | serial PK |
| telegram_id | varchar(64) unique |
| username | varchar(255) |
| region | varchar(64) |
| queue | varchar(16) |
| router_ip | varchar(255) |
| is_active | boolean |
| is_blocked | boolean |
| last_menu_message_id | integer |
| created_at / updated_at | timestamp |

### `user_notification_settings`
FK → users.id (CASCADE delete)

Поля: notify_schedule_changes, notify_remind_off, notify_fact_off, notify_remind_on, notify_fact_on, remind_15m, remind_30m, remind_1h, notify_schedule_target, notify_remind_target, notify_power_target, auto_delete_commands, auto_delete_bot_messages

### `user_channel_config`
FK → users.id (CASCADE delete)

Поля: channel_id, channel_title, channel_status, channel_paused, schedule_caption, period_format, picture_only, ch_notify_*, ch_remind_*, delete_old_message...

### `user_power_tracking`
FK → users.id (CASCADE delete)

Поля: power_state, power_changed_at, pending_power_state, last_alert_off_period, bot_power_message_id, ch_power_message_id...

## Сервісні таблиці

| Таблиця | Призначення |
|---------|-------------|
| `settings` | key/value store |
| `schedule_checks` | Останні перевірки (region+queue PK) |
| `schedule_daily_snapshots` | Щоденні знімки |
| `pending_notifications` | Черга сповіщень |
| `sent_reminders` | Дедуплікація нагадувань |
| `user_power_states` | Стан живлення (telegram_id PK) |
| `power_history` | Історія живлення |
| `outage_history` | Історія відключень |
| `tickets` + `ticket_messages` | Підтримка |
| `ping_error_alerts` | Помилки пінгу |
| `pending_channels` | Канали на підтвердження |
| `pause_log` | Лог паузи |
| `admin_routers` | Роутери адмінів |

## Міграції

```bash
npm run db:generate   # Генерувати нову міграцію
npm run db:migrate    # Застосувати міграції
npm run db:studio     # Drizzle Studio UI
```

Міграції автоматично застосовуються при старті бота.
