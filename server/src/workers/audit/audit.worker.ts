import { Injectable, OnModuleInit, Logger, Inject } from "@nestjs/common";
import Redis from "ioredis";
import { query } from "../../utils/db/db"; // adjust path if needed
import * as dotenv from "dotenv";

dotenv.config();

@Injectable()
export class AuditLogService implements OnModuleInit {
  private readonly channel: string;
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@Inject("REDIS_CLIENT") private readonly redis: Redis) {
    this.channel = process.env.AUDIT_LOG_CHANNEL || "audit:events";
  }

  onModuleInit() {
    this.redis.subscribe(this.channel, () => {
      this.logger.log(`Listening for audit events on "${this.channel}"...`);
    });

    this.redis.on("message", async (_, message) => {
      try {
        const data = JSON.parse(message);

        await query(
          `
          INSERT INTO audit_logs (actor, action, resource, ip, user_agent, meta)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
          [
            data.actor || null,
            data.action,
            data.resource || null,
            data.ip || null,
            data.userAgent || null,
            data.meta || {},
          ]
        );

        this.logger.log(`Audit event saved: ${data.action}`);
      } catch (err) {
        this.logger.error("Failed to save audit event", err);
      }
    });
  }
}
