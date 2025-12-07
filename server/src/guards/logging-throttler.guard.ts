import { Injectable, ExecutionContext, Logger } from "@nestjs/common";
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerRequest,
} from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";
import { throttledRequestsTotal } from "../metrics/api.metrics";

@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger("RateLimit");

  constructor(options: any, storageService: any, reflector: Reflector) {
    super(options, storageService, reflector);
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest
  ): Promise<boolean> {
    const { context } = requestProps;
    const req = context.switchToHttp().getRequest();

    // NestJS v10: per‑route metadata is already resolved by base guard
    // → no need to manually fetch THROTTLER_LIMIT/TTL
    this.logger.log(
      `Checking rate limit for ${req.ip} on ${req.method} ${req.url}`
    );

    return super.handleRequest(requestProps);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail
  ): Promise<void> {
    const req = context.switchToHttp().getRequest();

    this.logger.warn(
      `Rate limit exceeded for IP ${req.ip} on ${req.method} ${req.url}. Limit=${throttlerLimitDetail.limit}, TTL=${throttlerLimitDetail.ttl}s`
    );

    throttledRequestsTotal
      .labels(req.method, req.route?.path || req.path)
      .inc();

    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
