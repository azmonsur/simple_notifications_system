import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Client, ClientConfig } from "pg";
import {
  LogicalReplicationService,
  Wal2JsonPlugin,
} from "pg-logical-replication";
import {
  publishBatchToQueue,
  publishDelivery,
  CHANNEL_QUEUES,
} from "../../utils/rabbitmq";
import { pool } from "../../utils/db";
import { logger } from "../../utils/logger";

import * as dotenv from "dotenv";
dotenv.config();

const REPLICATION_SLOT = process.env.OUTBOX_REPLICATION_SLOT ?? "outbox_slot";
const REPLICATION_PLUGIN = process.env.OUTBOX_REPLICATION_PLUGIN ?? "wal2json";
const PUBLICATION_NAME = process.env.OUTBOX_PUBLICATION ?? "outbox_pub";

interface OutboxChange {
  kind: "insert" | "update" | "delete";
  schema: string;
  table: string;
  columnnames?: string[];
  columnvalues?: any[];
}

/**
 * Unified interface reflecting the full database outbox table structure
 */
interface OutboxRow {
  id: string;
  payload: any;
  attempts: number;
  status: string;
  [key: string]: any;
}

/**
 * Determines the correct database connection string based on NODE_ENV.
 * This connection must use a user with REPLICATION privileges.
 */
const getReplicationConnectionString = (): string => {
  const isProd = process.env.NODE_ENV === "production";
  const connStr = isProd
    ? process.env.POSTGRE_URL_PROD // Use production URL
    : process.env.POSTGRE_URL_DEV; // Use development URL

  if (!connStr) {
    // Critical safeguard: throw if the required URL is missing
    throw new Error(
      `Missing database connection string for ${
        isProd ? "PRODUCTION" : "DEVELOPMENT"
      } (POSTGRE_URL_${isProd ? "PROD" : "DEV"}).`
    );
  }

  return connStr;
};

@Injectable()
export class OutboxCdcService implements OnModuleInit, OnModuleDestroy {
  private replication: LogicalReplicationService | null = null;
  private running = false;

  async onModuleInit() {
    logger.info("🚀 Starting Outbox CDC consumer...");
    this.running = true;
    await this.ensureReplicationSlot();
    this.startStream().catch((err) => logger.error("CDC start error:", err));
  }

  async onModuleDestroy() {
    this.running = false;
    if (this.replication) {
      try {
        await this.replication.stop();
      } catch (e) {
        logger.warn("Error stopping logical replication client", e);
      }
    }
    logger.info("🛑 Outbox CDC stopped");
  }

  private async ensureReplicationSlot() {
    // Dynamically select connection string based on NODE_ENV
    const connectionString = getReplicationConnectionString();

    const client = new Client({
      connectionString: connectionString,
    });
    await client.connect();

    try {
      // Check if slot exists
      const slotExists = await client.query(
        `SELECT 1 FROM pg_replication_slots WHERE slot_name = $1`,
        [REPLICATION_SLOT]
      );
      if (!slotExists.rowCount) {
        logger.info(`Creating replication slot "${REPLICATION_SLOT}"`);
        await client.query(
          `SELECT * FROM pg_create_logical_replication_slot($1, $2)`,
          [REPLICATION_SLOT, REPLICATION_PLUGIN]
        );
      }

      const pubExists = await client.query(
        `SELECT 1 FROM pg_publication WHERE pubname = $1`,
        [PUBLICATION_NAME]
      );
      if (!pubExists.rowCount) {
        logger.info(`Creating publication "${PUBLICATION_NAME}"`);
        await client.query(
          `CREATE PUBLICATION ${PUBLICATION_NAME} FOR TABLE outbox`
        );
      }
    } finally {
      await client.end();
    }
  }

  private async startStream() {
    const plugin = new Wal2JsonPlugin({
      includeLsn: true,
      includeTimestamp: true,
      includeXids: true,
      includeSchemas: true,
      includeTypes: true,
      includeTypeOids: true,
    }); // Dynamically select connection string based on NODE_ENV

    const clientConfig: ClientConfig = {
      connectionString: getReplicationConnectionString(),
    };

    this.replication = new LogicalReplicationService(clientConfig);

    const stream = await this.replication.subscribe(
      plugin as any,
      REPLICATION_SLOT
    );

    stream.on("data", async (msg: string | Record<string, any>) => {
      const data = typeof msg === "string" ? JSON.parse(msg) : msg;
      const changes: OutboxChange[] = data.change ?? [];
      const toPublish: OutboxRow[] = [];
      const successfullyPublishedIds: string[] = [];
      for (const change of changes) {
        if (change.table !== "outbox") continue;

        // --- CDC-ONLY LOGIC: Process INSERTs (new messages) OR UPDATEs where status is 'pending' (retries) ---
        if (change.kind === "insert" || change.kind === "update") {
          // Initialize with mandatory fields, fill others from CDC data
          const row: OutboxRow = {
            id: "",
            payload: {},
            attempts: 0,
            status: "pending",
          };
          (change.columnnames ?? []).forEach((col, i) => {
            // This dynamically fills all properties like id, payload, status, and attempts
            row[col] = change.columnvalues?.[i];
          });
          // If it's a new insert, OR if it's an update where the status is being set back to 'pending' (retry signal)
          if (row.status === "pending" || change.kind === "insert") {
            try {
              row.payload =
                typeof row.payload === "string"
                  ? JSON.parse(row.payload)
                  : row.payload;
            } catch (_) {}
            toPublish.push(row);
          }
        }
      }

      const grouped: Record<string, OutboxRow[]> = {};
      for (const r of toPublish) {
        const ch = r.payload?.channel;
        if (!ch) {
          logger.warn(`Outbox row ${r.id} has no channel, skipping`);
          continue;
        }
        grouped[ch] = grouped[ch] ?? [];
        grouped[ch].push(r);
      }

      for (const [queueKey, batch] of Object.entries(grouped)) {
        const queueName = (CHANNEL_QUEUES as Record<string, string>)[queueKey];
        if (!queueName) {
          for (const p of batch) await publishDelivery(p.payload);
          successfullyPublishedIds.push(
            ...batch.map((b) => b.id).filter(Boolean)
          );
          continue;
        }

        try {
          await publishBatchToQueue(
            queueName,
            batch.map((b) => b.payload)
          );
          logger.info(`✅ Published ${batch.length} messages → ${queueName}`);
          successfullyPublishedIds.push(
            ...batch.map((b) => b.id).filter(Boolean)
          );
        } catch (err) {
          // --- CRITICAL FAILURE HANDLING (RabbitMQ issue) ---
          const idsToFail = batch.map((r) => r.id);
          const errMsg = err instanceof Error ? err.message : String(err);

          logger.error(
            `❌ CDC failed to publish batch to ${queueName}. Marking ${idsToFail.length} rows as 'failed': ${errMsg}`
          ); // Update status to 'failed' and increment attempts.

          // The separate retry service must later flip this back to 'pending'.
          try {
            await pool.query(
              `UPDATE outbox SET status='failed', error=LEFT($1, 255), attempts=attempts+1, updated_at=NOW() WHERE id = ANY($2::uuid[])`,
              [errMsg, idsToFail]
            );
          } catch (dbErr) {
            logger.error(
              "⚠️ Failed to mark CDC failed rows as 'failed' in DB:",
              dbErr
            );
          }
        }
      }

      if (successfullyPublishedIds.length) {
        try {
          await pool.query(
            `UPDATE outbox SET status='published', updated_at=NOW() WHERE id = ANY($1::uuid[])`,
            [successfullyPublishedIds]
          );
        } catch (err) {
          logger.error("Failed to mark outbox rows as published:", err);
        }
      }

      if (typeof msg === "object" && typeof msg.ack === "function") msg.ack();
    });

    stream.on("error", (err) =>
      logger.error("Logical replication error:", err)
    );

    logger.info("✅ Outbox CDC stream started");
  }
}
