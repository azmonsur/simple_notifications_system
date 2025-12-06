import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as cron from "node-cron";
import { retryQuery } from "../../utils/db";
import Redis from "ioredis";

// 1. Define the custom Redis instance type to include the new command
type GlobalSchedulerRedis = Redis & {
  /**
   * Atomically deletes the key only if the value stored there matches the expected value.
   * This is implemented via a Lua script.
   * @returns 1 if the key was deleted, 0 otherwise.
   */
  delLock(key: string, value: string): Promise<number>;
};

@Injectable()
export class GlobalSchedulerService implements OnModuleInit {
  private readonly logger = new Logger("GlobalScheduler");
  private readonly redis: GlobalSchedulerRedis;
  private readonly LOCK_TTL = 60; // Lock expires in 60 seconds

  constructor() {
    // Connect to Redis using env variable
    const redisInstance = new Redis(
      process.env.REDIS_URL as string
    ) as GlobalSchedulerRedis;

    // 2. Define the custom command for atomic lock deletion
    // This script ensures that a lock is only released by the instance that set it.
    redisInstance.defineCommand("delLock", {
      numberOfKeys: 1, // The script expects the lock key
      lua: `
        if redis.call("GET", KEYS[1]) == ARGV[1]
        then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `,
    });

    this.redis = redisInstance;
  }

  onModuleInit() {
    this.logger.log("GlobalSchedulerService initialized, scheduling tasks...");

    // --- 1. Clean expired refresh tokens daily at 00:10 ---
    cron.schedule("10 0 * * *", () => {
      this.runWithLock("lock:cleanExpiredRefreshTokens", () =>
        this.cleanExpiredRefreshTokens()
      );
    });

    // --- 2. Clean old user sessions weekly (Sunday 01:00 AM) ---
    cron.schedule("0 1 * * 0", () => {
      this.runWithLock("lock:cleanOldSessions", () => this.cleanOldSessions());
    });

    // You can add more scheduled tasks here
  }

  private async runWithLock(lockKey: string, taskFn: () => Promise<void>) {
    const lockValue = "locked"; // Value used for the lock token

    try {
      // 🔑 Acquire the lock using SET with NX and EX (Atomically Set If Not Exists and Expire)
      // This uses the correct ioredis set signature with string arguments for options.
      const acquired = await this.redis.set(
        lockKey,
        lockValue,
        "EX", // Expiration in seconds option
        this.LOCK_TTL, // Expiration value
        "NX" // Set If Not Exists option
      );

      // Check for "OK". If the key already existed, acquired will be null.
      if (acquired !== "OK") {
        this.logger.log(`Lock "${lockKey}" already held. Skipping this run.`);
        return;
      }

      this.logger.log(`Lock "${lockKey}" acquired. Running task...`);
      await taskFn();
    } catch (err) {
      this.logger.error(
        `Error running scheduled task for lock "${lockKey}"`,
        err
      );
    } finally {
      // 🔒 Atomic Lock Release using the custom Lua command (delLock)
      // This ensures the lock is only released by the process that set it, protecting against race conditions.
      const deletedCount = await this.redis.delLock(lockKey, lockValue);

      if (deletedCount > 0) {
        this.logger.log(`Lock "${lockKey}" released.`);
      } else {
        // This indicates the lock may have expired or was released by another instance
        this.logger.warn(
          `Lock "${lockKey}" was not released (value did not match or expired).`
        );
      }
    }
  }

  private async cleanExpiredRefreshTokens() {
    try {
      const result = await retryQuery(
        `DELETE FROM refresh_tokens 
          WHERE expires_at < NOW()
          OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')`
      );
      this.logger.log(`Expired refresh tokens removed: ${result?.rowCount}`);
    } catch (err) {
      this.logger.error("Error cleaning expired refresh tokens", err);
    }
  }

  private async cleanOldSessions() {
    try {
      const result = await retryQuery(
        `DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '30 days'`
      );
      this.logger.log(`Old user sessions removed: ${result?.rowCount}`);
    } catch (err) {
      this.logger.error("Error cleaning old user sessions", err);
    }
  }
}
