// rate-limit.decorator.ts
import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT_OPTIONS = "RATE_LIMIT_OPTIONS";

export interface RateLimitOptions {
  max: number; // per-route max requests
  window: number; // per-route window in seconds
  globalMax?: number; // optional global max requests
  globalWindow?: number; // optional global window in seconds
}

/**
 * @RateLimit(routeMax, routeWindow, globalMax?, globalWindow?)
 * Example: @RateLimit(5, 60) -> 5 requests per 60s for this route
 * Example: @RateLimit(5, 60, 100, 60) -> 5 per route, 100 global per IP
 */
export const RedisRateLimit = (
  max: number = 10,
  window: number = 60,
  globalMax?: number,
  globalWindow?: number
) => {
  const options: RateLimitOptions = { max: max, window: window };
  if (globalMax) options.globalMax = globalMax;
  if (globalWindow) options.globalWindow = globalWindow;
  return SetMetadata(RATE_LIMIT_OPTIONS, options);
};
