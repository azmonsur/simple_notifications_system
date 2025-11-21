// src/modules/webhook/webhook.module.ts
import { Module } from "@nestjs/common";

// Webhook controllers
import { TermiiWebhookController } from "./termii/termii.controller";
import { SendGridWebhookController } from "./sendgrid/sendgrid.controller";
import { WhatsAppWebhookController } from "./whatsapp_meta/whatsapp.controller";

@Module({
  controllers: [
    TermiiWebhookController,
    SendGridWebhookController,
    WhatsAppWebhookController,
  ],
  providers: [], // No providers needed unless you have services
})
export class WebhookModule {}
