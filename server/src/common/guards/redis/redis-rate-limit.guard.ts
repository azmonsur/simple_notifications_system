// rate-limit.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import Redis from "ioredis";
import {
  RATE_LIMIT_OPTIONS,
  RateLimitOptions,
} from "./redis-rate-limit.decorator";
import { TooManyRequestException } from "../../exceptions/error.exception";

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  constructor(
    @Inject("REDIS_CLIENT") private readonly redis: Redis,
    private readonly reflector: Reflector
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Skip rate-limiting in test mode
    if (process.env.LOAD_TESTING_MODE === "true") return true;

    try {
      const req = ctx.switchToHttp().getRequest();
      const res = ctx.switchToHttp().getResponse();
      if (req.method === "OPTIONS") return true;

      const ip = req.ip;
      const route = req.route?.path || req.url;

      let userId: any = undefined;
      if (req.user) {
        userId = req.user.sub;
      }

      const identifier = userId ? `user:${userId}` : `ip:${req.ip}`;

      // -------------------------------
      // Global limit (applies to all routes)
      // -------------------------------
      const globalMax = Number(process.env.RATE_LIMIT_MAX) || 100;
      const globalWindow = Number(process.env.RATE_LIMIT_WINDOW) || 60;
      const globalKey = `rate:${identifier}:global`;

      const globalCount = await this.redis.incr(globalKey);
      if (globalCount === 1) await this.redis.expire(globalKey, globalWindow);

      // Optional: headers for global usage
      res.setHeader("X-RateLimit-Global-Limit", globalMax);
      res.setHeader(
        "X-RateLimit-Global-Remaining",
        Math.max(0, globalMax - globalCount)
      );
      res.setHeader(
        "X-RateLimit-Global-Reset",
        await this.redis.ttl(globalKey)
      );

      if (globalCount > globalMax) {
        throw new TooManyRequestException({
          statusCode: 429,
          limit: globalMax,
          message: `Global API rate limit exceeded. Try again in ${await this.redis.ttl(
            globalKey
          )} seconds.`,
        });
      }

      // -------------------------------
      // Per-route limit (optional, only if decorator exists)
      // -------------------------------
      const routeOptions: RateLimitOptions =
        this.reflector.get<RateLimitOptions>(
          RATE_LIMIT_OPTIONS,
          ctx.getHandler()
        );

      if (routeOptions) {
        const routeKey = `rate:${identifier}:route:${route}`;
        const routeCount = await this.redis.incr(routeKey);

        if (routeCount === 1)
          await this.redis.expire(routeKey, routeOptions.window);

        res.setHeader("X-RateLimit-Limit", routeOptions.max);
        res.setHeader(
          "X-RateLimit-Remaining",
          Math.max(0, routeOptions.max - routeCount)
        );
        res.setHeader("X-RateLimit-Reset", await this.redis.ttl(routeKey));

        if (routeCount > routeOptions.max) {
          throw new TooManyRequestException({
            statusCode: 429,
            limit: routeOptions.max,
            message: `Rate limit exceeded for this endpoint. Try again in ${await this.redis.ttl(
              routeKey
            )} seconds.`,
          });
        }
      }

      return true;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`validateAdmin transaction error: ${errMsg}`);
      throw new InternalServerErrorException("Login failed");
    }
  }
}
