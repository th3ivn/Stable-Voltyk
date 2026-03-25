CREATE TABLE "admin_router_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"router_id" integer NOT NULL,
	"state" varchar(16) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_routers" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"router_ip" varchar(255) NOT NULL,
	"label" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_ticket_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"admin_id" integer NOT NULL,
	"remind_at" timestamp with time zone NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outage_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_minutes" integer,
	"source" varchar(32)
);
--> statement-breakpoint
CREATE TABLE "pause_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"action" varchar(32) NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"channel_id" varchar(64) NOT NULL,
	"channel_title" varchar(255),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(64) NOT NULL,
	"payload" text,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ping_error_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"state" varchar(16) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_checks" (
	"region" varchar(64) NOT NULL,
	"queue" varchar(16) NOT NULL,
	"last_hash" varchar(128),
	"last_checked_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone,
	CONSTRAINT "schedule_checks_region_queue_pk" PRIMARY KEY("region","queue")
);
--> statement-breakpoint
CREATE TABLE "schedule_daily_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"region" varchar(64) NOT NULL,
	"queue" varchar(16) NOT NULL,
	"date" varchar(10) NOT NULL,
	"data" text,
	"content_hash" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"region" varchar(64) NOT NULL,
	"queue" varchar(16) NOT NULL,
	"content_hash" varchar(128) NOT NULL,
	"data" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"reminder_key" varchar(255) NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"sender_type" varchar(16) NOT NULL,
	"message_text" text,
	"telegram_message_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_channel_config" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"channel_id" varchar(64),
	"channel_title" varchar(255),
	"channel_description" text,
	"channel_photo_file_id" varchar(255),
	"channel_user_title" varchar(255),
	"channel_user_description" text,
	"channel_status" varchar(32) DEFAULT 'active' NOT NULL,
	"channel_paused" boolean DEFAULT false NOT NULL,
	"channel_branding_updated_at" timestamp with time zone,
	"channel_guard_warnings" integer DEFAULT 0 NOT NULL,
	"last_published_hash" varchar(128),
	"last_post_id" integer,
	"last_schedule_message_id" integer,
	"last_power_message_id" integer,
	"schedule_caption" text,
	"period_format" text,
	"power_off_text" text,
	"power_on_text" text,
	"delete_old_message" boolean DEFAULT false NOT NULL,
	"picture_only" boolean DEFAULT false NOT NULL,
	"ch_notify_schedule" boolean DEFAULT true NOT NULL,
	"ch_notify_remind_off" boolean DEFAULT true NOT NULL,
	"ch_notify_remind_on" boolean DEFAULT true NOT NULL,
	"ch_notify_fact_off" boolean DEFAULT true NOT NULL,
	"ch_notify_fact_on" boolean DEFAULT true NOT NULL,
	"ch_remind_15m" boolean DEFAULT true NOT NULL,
	"ch_remind_30m" boolean DEFAULT false NOT NULL,
	"ch_remind_1h" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_message_tracking" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"last_bot_message_id" integer,
	"last_command_message_id" integer
);
--> statement-breakpoint
CREATE TABLE "user_notification_settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"notify_schedule_changes" boolean DEFAULT true NOT NULL,
	"notify_remind_off" boolean DEFAULT true NOT NULL,
	"notify_fact_off" boolean DEFAULT true NOT NULL,
	"notify_remind_on" boolean DEFAULT true NOT NULL,
	"notify_fact_on" boolean DEFAULT true NOT NULL,
	"remind_15m" boolean DEFAULT true NOT NULL,
	"remind_30m" boolean DEFAULT false NOT NULL,
	"remind_1h" boolean DEFAULT false NOT NULL,
	"notify_schedule_target" varchar(16) DEFAULT 'bot' NOT NULL,
	"notify_remind_target" varchar(16) DEFAULT 'bot' NOT NULL,
	"notify_power_target" varchar(16) DEFAULT 'bot' NOT NULL,
	"auto_delete_commands" boolean DEFAULT false NOT NULL,
	"auto_delete_bot_messages" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_power_states" (
	"telegram_id" varchar(64) PRIMARY KEY NOT NULL,
	"router_ip" varchar(255),
	"power_state" varchar(16),
	"last_checked_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_power_tracking" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"power_state" varchar(16),
	"power_changed_at" timestamp with time zone,
	"pending_power_state" varchar(16),
	"pending_power_change_at" timestamp with time zone,
	"last_power_state" varchar(16),
	"last_power_change" integer,
	"power_on_duration" integer,
	"last_alert_off_period" varchar(64),
	"last_alert_on_period" varchar(64),
	"alert_off_message_id" integer,
	"alert_on_message_id" integer,
	"last_ping_error_at" timestamp with time zone,
	"bot_power_message_id" bigint,
	"ch_power_message_id" bigint,
	"power_message_type" varchar(16)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_id" varchar(64) NOT NULL,
	"username" varchar(255),
	"region" varchar(64) NOT NULL,
	"queue" varchar(16) NOT NULL,
	"router_ip" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"last_menu_message_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
ALTER TABLE "admin_router_history" ADD CONSTRAINT "admin_router_history_router_id_admin_routers_id_fk" FOREIGN KEY ("router_id") REFERENCES "public"."admin_routers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_ticket_reminders" ADD CONSTRAINT "admin_ticket_reminders_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outage_history" ADD CONSTRAINT "outage_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_channels" ADD CONSTRAINT "pending_channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_notifications" ADD CONSTRAINT "pending_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ping_error_alerts" ADD CONSTRAINT "ping_error_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_history" ADD CONSTRAINT "power_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sent_reminders" ADD CONSTRAINT "sent_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_channel_config" ADD CONSTRAINT "user_channel_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_message_tracking" ADD CONSTRAINT "user_message_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_power_tracking" ADD CONSTRAINT "user_power_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outage_history_user_id_idx" ON "outage_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pending_notifications_user_id_idx" ON "pending_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "power_history_user_id_idx" ON "power_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "schedule_daily_snapshots_region_queue_date_idx" ON "schedule_daily_snapshots" USING btree ("region","queue","date");--> statement-breakpoint
CREATE INDEX "sent_reminders_user_id_key_idx" ON "sent_reminders" USING btree ("user_id","reminder_key");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_id_idx" ON "ticket_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_user_id_idx" ON "tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_telegram_id_idx" ON "users" USING btree ("telegram_id");