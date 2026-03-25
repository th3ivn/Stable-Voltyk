import type { BotContext } from "../bot.js";
import { findUserByTelegramId, createUser, reactivateUser } from "../db/queries/users.js";
import { getSettingBool } from "../db/queries/settings.js";
import { getRegionName } from "../constants/regions.js";
import {
  wizardRegionKeyboard,
  wizardQueueKeyboard,
  wizardNotifyTargetKeyboard,
  wizardNotifSettingsKeyboard,
  wizardDoneKeyboard,
  mainMenuKeyboard,
  deactivatedUserKeyboard,
} from "../keyboards/inline.js";
import {
  wizardStep1Message,
  wizardStep2Message,
  wizardStep3Message,
  wizardNotifSettingsMessage,
  wizardDoneMessage,
  deactivatedUserMessage,
  registrationDisabledMessage,
  formatMainMenuMessage,
} from "../formatters/messages.js";
import { findUserWithRelations, updateNotificationSettings } from "../db/queries/users.js";
import type { Bot } from "grammy";

export function registerStartHandlers(bot: Bot<BotContext>): void {
  // /start command
  bot.command("start", handleStart);

  // Wizard: region selection
  bot.callbackQuery(/^region_(.+)$/, handleRegionSelect);

  // Wizard: queue selection
  bot.callbackQuery(/^queue_page_(\d+)$/, handleQueuePage);
  bot.callbackQuery(/^queue_(.+)$/, handleQueueSelect);

  // Wizard: notify target
  bot.callbackQuery("wizard_notify_bot", handleWizardNotifyBot);
  bot.callbackQuery("wizard_notify_channel", handleWizardNotifyChannel);
  bot.callbackQuery("wizard_notify_back", handleWizardNotifyBack);

  // Wizard: notification toggles
  bot.callbackQuery("wizard_notif_toggle_schedule", handleWizardNotifToggle("wizardNotifSchedule"));
  bot.callbackQuery("wizard_notif_toggle_fact", handleWizardNotifToggle("wizardNotifFact"));
  bot.callbackQuery("wizard_notif_time_15", handleWizardNotifToggle("wizardNotifRemind15m"));
  bot.callbackQuery("wizard_notif_time_30", handleWizardNotifToggle("wizardNotifRemind30m"));
  bot.callbackQuery("wizard_notif_time_60", handleWizardNotifToggle("wizardNotifRemind1h"));

  // Wizard: done
  bot.callbackQuery("wizard_bot_done", handleWizardBotDone);

  // Deactivated user actions
  bot.callbackQuery("restore_profile", handleRestoreProfile);
  bot.callbackQuery("create_new_profile", handleCreateNewProfile);
}

// ============================================================
// /start — entry point
// ============================================================
async function handleStart(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (telegramId === undefined) return;

  const existingUser = await findUserByTelegramId(ctx.db, telegramId);

  // Existing active user → show main menu
  if (existingUser !== null && existingUser.isActive) {
    await showMainMenu(ctx, existingUser.id);
    return;
  }

  // Deactivated user → offer restore/new
  if (existingUser !== null && !existingUser.isActive) {
    await ctx.reply(deactivatedUserMessage(), {
      reply_markup: deactivatedUserKeyboard(),
    });
    return;
  }

  // New user — check if registration is enabled
  const registrationDisabled = await getSettingBool(ctx.db, "registration_disabled", false);
  if (registrationDisabled) {
    await ctx.reply(registrationDisabledMessage());
    return;
  }

  // Start wizard
  ctx.session.wizardStep = "region";
  ctx.session.wizardNotifSchedule = true;
  ctx.session.wizardNotifRemind15m = true;
  ctx.session.wizardNotifRemind30m = false;
  ctx.session.wizardNotifRemind1h = false;
  ctx.session.wizardNotifFact = false;

  await ctx.reply(wizardStep1Message(), {
    reply_markup: wizardRegionKeyboard(),
  });
}

// ============================================================
// Wizard Step 1: Region
// ============================================================
async function handleRegionSelect(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const match = ctx.callbackQuery?.data?.match(/^region_(.+)$/);
  const regionCode = match?.[1];
  if (regionCode === undefined) return;

  ctx.session.wizardStep = "queue";
  ctx.session.wizardRegion = regionCode;

  const regionName = getRegionName(regionCode);
  await ctx.editMessageText(wizardStep2Message(regionName), {
    reply_markup: wizardQueueKeyboard(regionCode, 1),
  });
}

// ============================================================
// Wizard Step 2: Queue pagination
// ============================================================
async function handleQueuePage(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const match = ctx.callbackQuery?.data?.match(/^queue_page_(\d+)$/);
  const page = match?.[1];
  if (page === undefined) return;

  const regionCode = ctx.session.wizardRegion ?? "kyiv";
  const regionName = getRegionName(regionCode);

  await ctx.editMessageText(wizardStep2Message(regionName), {
    reply_markup: wizardQueueKeyboard(regionCode, parseInt(page, 10)),
  });
}

// ============================================================
// Wizard Step 2: Queue selected
// ============================================================
async function handleQueueSelect(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  // Skip if it's a page navigation (already handled above)
  const data = ctx.callbackQuery?.data;
  if (data === undefined || data.startsWith("queue_page_")) return;

  const match = data.match(/^queue_(.+)$/);
  const queue = match?.[1];
  if (queue === undefined) return;

  ctx.session.wizardStep = "notify_target";
  ctx.session.wizardQueue = queue;

  await ctx.editMessageText(wizardStep3Message(queue), {
    reply_markup: wizardNotifyTargetKeyboard(),
  });
}

// ============================================================
// Wizard Step 3: Notify in bot
// ============================================================
async function handleWizardNotifyBot(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.wizardStep = "notif_settings";

  await ctx.editMessageText(wizardNotifSettingsMessage(), {
    reply_markup: wizardNotifSettingsKeyboard({
      schedule: ctx.session.wizardNotifSchedule ?? true,
      remind15m: ctx.session.wizardNotifRemind15m ?? true,
      remind30m: ctx.session.wizardNotifRemind30m ?? false,
      remind1h: ctx.session.wizardNotifRemind1h ?? false,
      fact: ctx.session.wizardNotifFact ?? false,
    }),
  });
}

// ============================================================
// Wizard Step 3: Notify in channel (skip to done, channel setup later)
// ============================================================
async function handleWizardNotifyChannel(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  // Create user and finish wizard — channel will be set up from settings
  await finishWizard(ctx);
}

// ============================================================
// Wizard: Back to notify target
// ============================================================
async function handleWizardNotifyBack(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const queue = ctx.session.wizardQueue ?? "1.1";
  ctx.session.wizardStep = "notify_target";

  await ctx.editMessageText(wizardStep3Message(queue), {
    reply_markup: wizardNotifyTargetKeyboard(),
  });
}

// ============================================================
// Wizard: Toggle notification setting
// ============================================================
function handleWizardNotifToggle(
  field:
    | "wizardNotifSchedule"
    | "wizardNotifFact"
    | "wizardNotifRemind15m"
    | "wizardNotifRemind30m"
    | "wizardNotifRemind1h",
) {
  return async (ctx: BotContext): Promise<void> => {
    await ctx.answerCallbackQuery();
    ctx.session[field] = !(ctx.session[field] ?? false);

    await ctx.editMessageText(wizardNotifSettingsMessage(), {
      reply_markup: wizardNotifSettingsKeyboard({
        schedule: ctx.session.wizardNotifSchedule ?? true,
        remind15m: ctx.session.wizardNotifRemind15m ?? true,
        remind30m: ctx.session.wizardNotifRemind30m ?? false,
        remind1h: ctx.session.wizardNotifRemind1h ?? false,
        fact: ctx.session.wizardNotifFact ?? false,
      }),
    });
  };
}

// ============================================================
// Wizard: Done (bot notifications)
// ============================================================
async function handleWizardBotDone(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await finishWizard(ctx);
}

// ============================================================
// Finish wizard: create user + apply settings
// ============================================================
async function finishWizard(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (telegramId === undefined) return;

  const region = ctx.session.wizardRegion;
  const queue = ctx.session.wizardQueue;
  if (region === undefined || queue === undefined) return;

  // Create user
  const newUser = await createUser(ctx.db, {
    telegramId,
    username: ctx.from?.username ?? null,
    region,
    queue,
  });

  // Apply notification settings
  await updateNotificationSettings(ctx.db, newUser.id, {
    notifyScheduleChanges: ctx.session.wizardNotifSchedule ?? true,
    remind15m: ctx.session.wizardNotifRemind15m ?? true,
    remind30m: ctx.session.wizardNotifRemind30m ?? false,
    remind1h: ctx.session.wizardNotifRemind1h ?? false,
    notifyFactOff: ctx.session.wizardNotifFact ?? false,
    notifyFactOn: ctx.session.wizardNotifFact ?? false,
  });

  // Clear wizard session
  ctx.session.wizardStep = undefined;
  ctx.session.wizardRegion = undefined;
  ctx.session.wizardQueue = undefined;

  // Show done message
  await ctx.editMessageText(wizardDoneMessage({ region, queue }), {
    reply_markup: wizardDoneKeyboard(),
  });
}

// ============================================================
// Restore deactivated profile
// ============================================================
async function handleRestoreProfile(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const telegramId = ctx.from?.id.toString();
  if (telegramId === undefined) return;

  const user = await findUserByTelegramId(ctx.db, telegramId);
  if (user === null) return;

  await reactivateUser(ctx.db, user.id);
  await showMainMenu(ctx, user.id);
}

// ============================================================
// Create new profile (delete old + start wizard)
// ============================================================
async function handleCreateNewProfile(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const telegramId = ctx.from?.id.toString();
  if (telegramId === undefined) return;

  const user = await findUserByTelegramId(ctx.db, telegramId);
  if (user !== null) {
    const { deleteUser } = await import("../db/queries/users.js");
    await deleteUser(ctx.db, user.id);
  }

  // Start wizard
  ctx.session.wizardStep = "region";
  ctx.session.wizardNotifSchedule = true;
  ctx.session.wizardNotifRemind15m = true;
  ctx.session.wizardNotifRemind30m = false;
  ctx.session.wizardNotifRemind1h = false;
  ctx.session.wizardNotifFact = false;

  await ctx.editMessageText(wizardStep1Message(), {
    reply_markup: wizardRegionKeyboard(),
  });
}

// ============================================================
// Show main menu (reusable)
// ============================================================
export async function showMainMenu(ctx: BotContext, userId: number): Promise<void> {
  const data = await findUserWithRelations(ctx.db, ctx.from?.id.toString() ?? "");
  if (data === null) return;

  const hasChannel =
    data.channelConfig?.channelId != null && data.channelConfig.channelId.length > 0;
  const hasNotifications = data.notificationSettings?.notifyScheduleChanges ?? false;

  const text = formatMainMenuMessage({
    region: data.user.region,
    queue: data.user.queue,
    hasChannel,
    channelTitle: data.channelConfig?.channelTitle,
    hasNotifications,
  });

  const keyboard = mainMenuKeyboard({
    hasChannel,
    channelPaused: data.channelConfig?.channelPaused ?? false,
  });

  // Try edit, fallback to send
  try {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } catch {
    const msg = await ctx.reply(text, { reply_markup: keyboard });
    // Store menu message id
    const { updateUser } = await import("../db/queries/users.js");
    await updateUser(ctx.db, userId, { lastMenuMessageId: msg.message_id });
  }
}
