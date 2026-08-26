import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop retrying
    }
    return Math.min(times * 50, 2000);
  },
});

redis.on('error', (err) => {
  console.warn('Redis connection error (Rate Limit disabled):', err.message);
});

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Basic fixed-window rate limiter using Redis.
 * Fails open (allows request) if Redis is down to prevent hanging.
 */
export async function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  if (redis.status !== 'ready') {
    // Fail open if Redis is down
    return { success: true, limit, remaining: limit, reset: Date.now() + windowMs };
  }

  try {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs);
    const redisKey = `${key}:${windowStart}`;

    const requests = await redis.incr(redisKey);
    
    if (requests === 1) {
      await redis.pexpire(redisKey, windowMs + 1000);
    }

    const remaining = Math.max(0, limit - requests);
    const reset = (windowStart + 1) * windowMs;

    return {
      success: requests <= limit,
      limit,
      remaining,
      reset
    };
  } catch (error) {
    console.error('Rate limit error, failing open:', error);
    return { success: true, limit, remaining: limit, reset: Date.now() + windowMs };
  }
}
