import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";

import { logger } from "../../utils/logger";

@Injectable()
export class RedisAuditService {
  private readonly redis: InstanceType<typeof Redis> | null;
  private readonly channel: string;

  constructor() {
    const url =
      process.env.NODE_ENV === "development"
        ? process.env.REDIS_URL_DEV
        : process.env.REDIS_URL_PROD;

    this.channel = process.env.AUDIT_LOG_CHANNEL || "audit:events";
    if (url) {
      this.redis = new Redis(url);
      //   logger.info("Connected to Redis server");
      this.redis.on("error", (e: any) => logger.error("Redis audit error", e));

      // 🔎 Added ping check
      this.redis
        .ping()
        .then((res) => logger.info(`Redis connected: ${res}`))
        .catch((err) => logger.error("Redis connection failed", err));
    } else {
      this.redis = null;
      logger.warn("No REDIS_URL configured — using local audit logs only");
    }
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
