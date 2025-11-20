import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { query } from "../../utils/db";
import { logger } from "../../utils/logger";

@Injectable()
export class WebhookService {
  // -------------------------------
  // 📩 HANDLE SMS WEBHOOK
  // -------------------------------
  async handleSmsWebhook(payload: any, headers: any) {
    logger.info(`SMS Webhook payload:, ${JSON.stringify(payload)}`);
    try {
      logger.info(`📩 SMS Webhook Received: ${JSON.stringify(payload)}`);

      const messageId = payload.message_id;
      const status = payload.status;

      // Save raw webhook log first
      await query(
        `INSERT INTO webhook_logs(provider, raw_payload, status, message_id)
         VALUES ($1, $2, $3, $4)`,
        ["sms", payload, status, messageId]
      );

      // Update matching notification
      await query(
        `UPDATE notifications
         SET provider_status=$1
         WHERE provider_message_id=$2`,
        [status, messageId]
      );

      return { ok: true };
    } catch (err: any) {
      logger.error(`❌ SMS Webhook error: ${err.message}`);
      // Still respond 200 so provider doesn't retry endlessly
      return { ok: true };
    }
  }

  // -------------------------------
  // 📧 HANDLE EMAIL WEBHOOK
  // -------------------------------
  async handleEmailWebhook(payload: any, headers: any) {
    logger.info(`EMAIL Webhook payload:, ${JSON.stringify(payload)}`);
    try {
      logger.info(`📧 Email Webhook Received: ${JSON.stringify(payload)}`);

      const status = payload.event;
      const messageId = payload?.message?.id;

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

      return { ok: true };
    } catch (err: any) {
      logger.error(`❌ Email Webhook error: ${err.message}`);
      return { ok: true };
    }
  }

  async handleWhatsAppWebhook(payload: any, headers: any) {
    logger.info(`WHATSAPP Webhook payload:, ${JSON.stringify(payload)}`);
    try {
      logger.info(`📧 WhatsApp Webhook Received: ${JSON.stringify(payload)}`);

      const status = payload.event;
      const messageId = payload?.message?.id;

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

      return { ok: true };
    } catch (err: any) {
      logger.error(`❌ WhatsApp Webhook error: ${err.message}`);
      return { ok: true };
    }
  }
}
