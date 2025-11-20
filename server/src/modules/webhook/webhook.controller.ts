import { Controller, Post, Body, Headers, HttpCode } from "@nestjs/common";
import { WebhookService } from "./webhook.service";
import { SmsWebhookDto } from "./dto/sms-webhook.dto";
import { EmailWebhookDto } from "./dto/email-webhook.dto";
import { WhatsAppWebhookDto } from "./dto/whatsapp-webhook.dto";

@Controller("webhook")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post("sms")
  @HttpCode(200)
  async smsWebhook(@Body() payload: any, @Headers() headers: any) {
    return this.webhookService.handleSmsWebhook(payload, headers);
  }

  @Post("email")
  @HttpCode(200)
  async emailWebhook(
    @Body() payload: EmailWebhookDto,
    @Headers() headers: any
  ) {
    return this.webhookService.handleEmailWebhook(payload, headers);
  }

  @Post("whatsapp")
  @HttpCode(200)
  async whatsAppWebhook(
    @Body() payload: WhatsAppWebhookDto,
    @Headers() headers: any
  ) {
    return this.webhookService.handleWhatsAppWebhook(payload, headers);
  }
}
