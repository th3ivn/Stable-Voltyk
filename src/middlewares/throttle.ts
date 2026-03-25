import type { NextFunction } from "grammy";
import type { BotContext } from "../bot.js";

// ============================================================
// Token Bucket rate limiter
// ============================================================
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
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

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

const userBuckets = new Map<number, TokenBucket>();

// 3 burst + 1 token per 2 seconds sustained
const MAX_TOKENS = 3;
const REFILL_RATE = 0.5;

export async function throttleMiddleware(ctx: BotContext, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  if (userId === undefined) {
    await next();
    return;
  }

  let bucket = userBuckets.get(userId);
  if (bucket === undefined) {
    bucket = new TokenBucket(MAX_TOKENS, REFILL_RATE);
    userBuckets.set(userId, bucket);
  }

  if (!bucket.tryConsume()) {
    if (ctx.callbackQuery !== undefined) {
      await ctx.answerCallbackQuery("⏳ Занадто швидко. Зачекайте трохи.");
    }
    return;
  }

  await next();
}

// Cleanup old buckets periodically (every 10 minutes)
setInterval(
  () => {
    if (userBuckets.size > 10000) {
      userBuckets.clear();
    }
  },
  10 * 60 * 1000,
);
