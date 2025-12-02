import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel, publishDeliveryToBucket } from "../../../utils/rabbitmq";
import { query } from "../../../utils/db";
import { logger } from "../../../utils/logger";

@Injectable()
export class SendGridDlrWorkerService implements OnModuleInit, OnModuleDestroy {
  private channel: any = null;
  private readonly QUEUE = "dlr.sendgrid";
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY = 5000;

  async onModuleInit() {
    logger.info("📧 SendGrid DLR Worker starting...");
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

    logger.info(`✅ SendGrid DLR Worker consuming from ${this.QUEUE}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🛑 SendGrid DLR Worker stopped.");
  }

  private async processMessage(msg: any) {
    const attempt = msg.properties.headers?.["x-attempt"] || 1;

    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
      console.log("Parsed SendGrid DLR payload:", payload);
    } catch (err) {
      logger.error("❌ Invalid SendGrid DLR JSON", err);
      return this.safeNack(msg, false, false);
    }

    try {
      await query(
        `
        INSERT INTO webhook_logs
          (provider, channel, message_id, external_id, recipient, sender, status, cost, raw_payload, sent_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
        ON CONFLICT (provider, message_id) DO UPDATE
        SET status = EXCLUDED.status,
            retries = webhook_logs.retries,
            updated_at = NOW();
      `,
        [
          "sendgrid",
          "email",
          payload.sg_message_id.split(".")[0] || payload.id,
          payload.sg_event_id || null,
          payload.email || payload.to,
          null,
          payload.event.toLowerCase() || "unknown",
          null,
          payload,
          payload.timestamp
            ? new Date(payload.timestamp * 1000).toISOString()
            : null,
        ]
      );

      this.safeAck(msg);
    } catch (err: any) {
      logger.warn(`❌ SendGrid DLR attempt ${attempt} failed: ${err.message}`);

      if (attempt < this.MAX_RETRIES) {
        const delay = this.BASE_DELAY * 2 ** (attempt - 1);

        // ✅ Use bucket-based retry instead of publishDLRDelayed
        payload.attempts = attempt + 1;
        payload.channel = "email"; // specify channel for bucket system
        await publishDeliveryToBucket(payload.channel, payload, attempt + 1);

        this.safeAck(msg);
        logger.info(
          `♻️ SendGrid DLR scheduled retry #${attempt + 1} via bucket system`
        );
      } else {
        this.safeNack(msg, false, false);
        logger.error("❌ SendGrid DLR max retries reached, moved to DLQ");
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
