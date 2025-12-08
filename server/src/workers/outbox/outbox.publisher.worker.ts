// src/workers/outbox/outbox.worker.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { pool } from "../../utils/db/db";
import type { PoolClient } from "pg";
import {
  publishBatchToQueue,
  publishDeliveryToBucket,
  CHANNEL_QUEUES,
} from "../../utils/rabbitmq/rabbitmq";
import { logger } from "../../utils/logger/logger";

const BATCH_SIZE = 100; // Number of messages per batch
const POLL_INTERVAL_MS = 3000; // 2 seconds

type ChannelKey = keyof typeof CHANNEL_QUEUES;

interface OutboxRow {
  id: string;
  payload: any;
  attempts: number;
  status: string;
}

@Injectable()
export class OutboxWorkerService implements OnModuleInit, OnModuleDestroy {
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;

  async onModuleInit() {
    logger.info("🚀 Outbox Worker starting...");
    logger.info(
      `⚙️ Configuration: BATCH_SIZE=${BATCH_SIZE}, POLL_INTERVAL=${POLL_INTERVAL_MS}ms`
    );
    this.startProcessing();
  }

  async onModuleDestroy() {
    logger.info("🛑 Outbox Worker shutting down...");
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    logger.info("✅ Outbox Worker stopped.");
  }

  private startProcessing() {
    this.isRunning = true;
    this.processingInterval = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.processOutboxBatch();
      } catch (err) {
        logger.error("❌ Worker loop error:", (err as Error).message);
      }
    }, POLL_INTERVAL_MS); // Process first batch immediately

    this.processOutboxBatch().catch((err) =>
      logger.error("❌ Initial batch error:", err)
    );
  }
  /**
   * Fetches pending outbox rows within a transaction using FOR UPDATE SKIP LOCKED
   * to prevent concurrent workers from processing the same rows
   */

  private async fetchPendingOutbox(
    client: PoolClient,
    batchSize: number
  ): Promise<OutboxRow[]> {
    const res = await client.query(
      `SELECT id, payload, attempts, status FROM outbox WHERE status='pending' ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );
    return res.rows;
  }
  /**
   * Marks an outbox row as successfully published
   */

  private async markOutboxAsPublished(client: PoolClient, ids: string[]) {
    await client.query(
      `UPDATE outbox SET status = 'published', updated_at = NOW() WHERE id = ANY ($1)`,
      [ids]
    );
  }
  /**
   * Marks an outbox row as failed with error details.
   * IMPORTANT: This uses the connection pool directly to commit the failure status
   * immediately, isolating this update from the main transaction.
   */

  private async markOutboxAsFailed(
    id: string,
    error: string,
    attempts: number
  ) {
    try {
      await pool.query(
        // Using pool.query instead of the client
        `UPDATE outbox SET status = 'failed', error = $1, attempts = $2, updated_at = NOW() WHERE id = $3`,
        [error, attempts, id]
      );
    } catch (dbErr: unknown) {
      // Log the failure to update the status, but do NOT re-throw,
      // as this would abort the main batch transaction.
      const dbErrMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
      logger.error(
        `❌ CRITICAL: Failed to update outbox status for ${id}: ${dbErrMsg}`
      );
    }
  }
  /**
   * Processes a batch of outbox rows:
   * 1. Fetches pending rows in a transaction
   * 2. Groups by channel
   * 3. Publishes to RabbitMQ per channel
   * 4. Marks as published on success or enqueues retry on failure
   */

  private async processOutboxBatch() {
    const client = await pool.connect();
    try {
      await client.query("BEGIN"); // Fetch pending rows with row-level locks

      const batch = await this.fetchPendingOutbox(client, BATCH_SIZE);
      if (!batch.length) {
        await client.query("COMMIT");
        return;
      }

      logger.info(`📦 Processing batch of ${batch.length} outbox rows`); // Group by channel for batch publishing

      const grouped: Record<string, OutboxRow[]> = {};
      for (const row of batch) {
        const channel = row.payload.channel;
        if (!channel) {
          logger.warn(
            `⚠️ Skipping outbox row ${row.id} - no channel specified`
          );
          continue;
        }
        grouped[channel] = grouped[channel] ?? [];
        grouped[channel].push(row);
      } // Process each channel's batch

      for (const [channelKey, rows] of Object.entries(grouped)) {
        // Map channel key to actual queue name
        const queueName = CHANNEL_QUEUES[channelKey as ChannelKey];
        if (!queueName) {
          logger.warn(
            `⚠️ Unknown channel: ${channelKey}, skipping ${rows.length} rows`
          );
          continue;
        }

        const payloads = rows.map((r) => r.payload);

        try {
          // Attempt to publish batch to RabbitMQ
          await publishBatchToQueue(queueName, payloads); // Mark each row as successfully published

          const ids = rows.map((row) => row.id);
          await this.markOutboxAsPublished(client, ids);

          logger.info(
            `✅ Successfully published ${rows.length} messages to ${queueName}`
          );
        } catch (err: any) {
          const errMsg = err instanceof Error ? err.message : String(err);
          logger.error(
            `❌ Failed to publish batch for channel ${channelKey}: ${errMsg}`
          ); // Handle retry for each failed row

          for (const row of rows) {
            try {
              const nextAttempt = (row.attempts ?? 0) + 1; // Send to delay bucket for retry

              await publishDeliveryToBucket(
                channelKey,
                row.payload,
                nextAttempt
              ); // Mark as failed in database using the isolated function

              await this.markOutboxAsFailed(row.id, errMsg, nextAttempt);

              logger.info(
                `⏳ Outbox ${row.id} enqueued for retry (attempt ${nextAttempt})`
              );
            } catch (innerErr: unknown) {
              // CRITICAL ERROR HANDLING: Failure in external RabbitMQ/retry logic
              // Log the failure but DO NOT attempt markOutboxAsFailed again,
              // and DO NOT re-throw, allowing the outer loop to continue.
              const innerMsg =
                innerErr instanceof Error ? innerErr.message : String(innerErr);
              logger.error(
                `⚠️ Failed to enqueue retry for outbox ${row.id}. Status remains 'pending'. Error: ${innerMsg}`
              );
            }
          }
        }
      }

      await client.query("COMMIT");
      logger.info(`✅ Batch processing complete`);
    } catch (err: any) {
      await client.query("ROLLBACK");
      logger.error("❌ Outbox worker batch failed and rolled back:", err);
    } finally {
      client.release();
    }
  }
}
