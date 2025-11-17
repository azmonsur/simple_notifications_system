import { Injectable, ExecutionContext, Logger } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerLimitDetail } from "@nestjs/throttler";
import { throttledRequestsTotal } from "../metrics/api.metrics";

@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger("RateLimit");

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail
  ): Promise<void> {
    const req = context.switchToHttp().getRequest();
    this.logger.warn(
      `Rate limit exceeded for IP ${req.ip} on ${req.method} ${req.url}. Limit: ${throttlerLimitDetail.limit}, TTL: ${throttlerLimitDetail.ttl}s`
    );
    throttledRequestsTotal
      .labels(req.method, req.route?.path || req.path)
      .inc();
    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
