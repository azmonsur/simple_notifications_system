import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import {
  getChannel,
  publishDeliveryToBucket,
} from "../../../utils/rabbitmq/rabbitmq";
import { query } from "../../../utils/db/db";
import { logger } from "../../../utils/logger/logger";

@Injectable()
export class TermiiDlrWorkerService implements OnModuleInit, OnModuleDestroy {
  private channel: any = null;
  private readonly QUEUE = "dlr.termii";
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY = 5000;

  async onModuleInit() {
    logger.info("📲 Termii DLR Worker starting...");
    this.channel = await getChannel();
    this.channel.prefetch(5);

    await this.channel.consume(
      this.QUEUE,
      async (msg: any | null) => {
        if (!msg) return;
        await this.processMessage(msg);
      },
      { noAck: false }
    );

    logger.info(`✅ Termii DLR Worker consuming from ${this.QUEUE}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🛑 Termii DLR Worker stopped.");
  }

  private async processMessage(msg: any) {
    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error("❌ Invalid Termii DLR JSON", err);
      return this.safeNack(msg, false, false);
    }

    const attempt = msg.properties.headers?.["x-attempt"] || 1;

    try {
      await query(
        `
        INSERT INTO webhook_logs
          (provider, channel, message_id, external_id, recipient, sender, status, cost, raw_payload, sent_at, delivered_at, retries)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
        ON CONFLICT (provider, message_id) DO UPDATE
        SET status = EXCLUDED.status,
            delivered_at = COALESCE(EXCLUDED.delivered_at, webhook_logs.delivered_at),
            retries = webhook_logs.retries,
            updated_at = NOW();
      `,
        [
          "termii",
          "sms",
          payload.message_id,
          payload.notify_id,
          payload.receiver,
          payload.sender,
          payload.status.split(" | ")[0].toLowerCase(),
          payload.cost ? parseFloat(payload.cost) : null,
          payload,
          payload.sent_at ? new Date(payload.sent_at).toISOString() : null,
          payload.delivered_at
            ? new Date(payload.delivered_at).toISOString()
            : null,
          attempt,
        ]
      );

      this.safeAck(msg);
    } catch (err: any) {
      logger.warn(`❌ Termii DLR attempt ${attempt} failed: ${err.message}`);
      if (attempt < this.MAX_RETRIES) {
        const delay = this.BASE_DELAY * 2 ** (attempt - 1);

        // ✅ Use bucket-based retry instead of publishDLRDelayed
        payload.attempts = attempt + 1;
        payload.channel = "sms"; // specify channel for bucket system
        await publishDeliveryToBucket(payload.channel, payload, attempt + 1);

        this.safeAck(msg);
        logger.info(
          `♻️ Termii DLR scheduled retry #${attempt + 1} via bucket system`
        );
      } else {
        this.safeNack(msg, false, false);
        logger.error("❌ Termii DLR max retries reached, moved to DLQ");
      }
    }
  }

  private safeAck(msg: any) {
    try {
      this.channel.ack(msg);
    } catch (err) {
      logger.error("safeAck failed:", err);
    }
  }

  private safeNack(msg: any, allUpTo = false, requeue = false) {
    try {
      this.channel.nack(msg, allUpTo, requeue);
    } catch (err) {
      logger.error("safeNack failed:", err);
    }
  }
}
