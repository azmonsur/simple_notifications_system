import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import {
  getChannel,
  publishDeliveryToBucket,
} from "../../../utils/rabbitmq/rabbitmq";
import { query } from "../../../utils/db/db";
import { logger } from "../../../utils/logger/logger";

@Injectable()
export class WhatsAppDlrWorkerService implements OnModuleInit, OnModuleDestroy {
  private channel: any = null;
  private readonly QUEUE = "dlr.whatsapp.meta";
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY = 5000;

  async onModuleInit() {
    logger.info("💬 WhatsApp Meta DLR Worker starting...");
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

    logger.info(`✅ WhatsApp DLR Worker consuming from ${this.QUEUE}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🛑 WhatsApp DLR Worker stopped.");
  }

  private async processMessage(msg: any) {
    const attempt = msg.properties.headers?.["x-attempt"] || 1;
    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error("❌ Invalid WhatsApp DLR JSON", err);
      return this.safeNack(msg, false, false);
    }

    const message_id =
      payload.entry[0].changes[0].value.statuses[0].id.split(".")[1];
    const recipient_id =
      payload.entry[0].changes[0].value.statuses[0].recipient_id;
    const message_from =
      payload.entry[0].changes[0].value.metadata.display_phone_number;
    const error_info =
      payload.entry[0].changes[0].value.statuses[0].errors[0].error_data
        .details;

    const message_status = payload.entry[0].changes[0].value.statuses[0].status;
    const timestamp = payload.entry[0].changes[0].value.statuses[0].timestamp;
    const external_id = payload.entry[0].id;

    try {
      await query(
        `
        INSERT INTO webhook_logs
          (provider, channel, message_id, external_id, recipient, sender, status, cost, raw_payload, sent_at, delivered_at, retries, remark)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)
        ON CONFLICT (provider, message_id) DO UPDATE
        SET status = EXCLUDED.status,
            delivered_at = COALESCE(EXCLUDED.delivered_at, webhook_logs.delivered_at),
            retries = webhook_logs.retries,
            updated_at = NOW();
      `,
        [
          "whatsapp_meta",
          "whatsapp",
          message_id,
          external_id || null,
          recipient_id || null,
          message_from || null,
          message_status.toLowerCase() || "unknown",
          null,
          payload,
          timestamp ? new Date(timestamp * 1000).toISOString() : null,
          timestamp ? new Date(timestamp * 1000).toISOString() : null,
          attempt,
          error_info || null,
        ]
      );

      this.safeAck(msg);
    } catch (err: any) {
      logger.warn(`❌ WhatsApp DLR attempt ${attempt} failed: ${err.message}`);

      if (attempt < this.MAX_RETRIES) {
        // ✅ Use bucket-based retry instead of publishDLRDelayed
        payload.attempts = attempt + 1;
        payload.channel = "whatsapp"; // specify channel for bucket system
        await publishDeliveryToBucket(payload.channel, payload, attempt + 1);

        this.safeAck(msg);
        logger.info(
          `♻️ WhatsApp DLR scheduled retry #${attempt + 1} via bucket system`
        );
      } else {
        this.safeNack(msg, false, false);
        logger.error("❌ WhatsApp DLR max retries reached, moved to DLQ");
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
