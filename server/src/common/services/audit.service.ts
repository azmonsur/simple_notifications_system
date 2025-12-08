import { Injectable, Inject } from "@nestjs/common";
import Redis from "ioredis";

import { logger } from "../../utils/logger/logger";

@Injectable()
export class RedisAuditService {
  private readonly channel: string;

  constructor(@Inject("REDIS_CLIENT") private readonly redis: Redis) {
    this.channel = process.env.AUDIT_LOG_CHANNEL || "audit:events";
  }

  async audit(event: {
    actor?: string; // userId or system
    action: string;
    resource?: string;
    ip?: string;
    userAgent?: string;
    meta?: Record<string, any>;
    timestamp?: string;
  }) {
    const payload = {
      actor: event.actor || "system",
      action: event.action,
      resource: event.resource || null,
      ip: event.ip || null,
      userAgent: event.userAgent || null,
      meta: event.meta || {},
      timestamp: event.timestamp || new Date().toISOString(),
    };

    // Publish to Redis channel for async processing
    if (this.redis) {
      try {
        await this.redis.publish(this.channel, JSON.stringify(payload));
      } catch (err) {
        logger.error("Failed to publish audit event to redis", err);
      }
    }

    // Always write to local structured log as fallback
    // logger.info({ audit: payload });
  }
}
