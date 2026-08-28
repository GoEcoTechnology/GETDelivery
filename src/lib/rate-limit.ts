export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Basic fixed-window rate limiter mocked out since Redis was removed.
 * Fails open (allows request) by default.
 */
export async function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  // Always fail open since we removed Redis
  return { success: true, limit, remaining: limit, reset: Date.now() + windowMs };
}
