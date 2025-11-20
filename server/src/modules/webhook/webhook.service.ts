import { Injectable } from "@nestjs/common";
import { query } from "../../utils/db";
import { logger } from "../../utils/logger";

@Injectable()
export class WebhookService {
  async handleSmsWebhook(payload: any, headers: any) {
    logger.info(`📩 SMS Webhook Received: ${JSON.stringify(payload)}`);

    const messageId = payload.message_id;
    const status = payload.status;

    // Save raw log
    await query(
      `INSERT INTO webhook_logs(provider, raw_payload, status, message_id)
       VALUES ($1, $2, $3, $4)`,
      ["sms", payload, status, messageId]
    );

    // Match notification by provider_message_id
    await query(
      `UPDATE notifications
       SET provider_status=$1
       WHERE provider_message_id=$2`,
      [status, messageId]
    );

    return { received: true };
  }

  async handleEmailWebhook(payload: any, headers: any) {
    logger.info(`📧 Email Webhook Received: ${JSON.stringify(payload)}`);

    const messageId = payload?.message?.id;
    const status = payload.event;

    await query(
      `INSERT INTO webhook_logs(provider, raw_payload, status, message_id)
       VALUES ($1, $2, $3, $4)`,
      ["email", payload, status, messageId]
    );

    await query(
      `UPDATE notifications
       SET provider_status=$1
       WHERE provider_message_id=$2`,
      [status, messageId]
    );

    return { received: true };
  }

  async handleWhatsAppWebhook(payload: any, headers: any) {
    logger.info(`📧 Email Webhook Received: ${JSON.stringify(payload)}`);

    const messageId = payload?.message?.id;
    const status = payload.event;

    await query(
      `INSERT INTO webhook_logs(provider, raw_payload, status, message_id)
       VALUES ($1, $2, $3, $4)`,
      ["whatsapp", payload, status, messageId]
    );

    await query(
      `UPDATE notifications
       SET provider_status=$1
       WHERE provider_message_id=$2`,
      [status, messageId]
    );

    return { received: true };
  }
}
