import { Controller, Post, Body, HttpCode, Logger } from "@nestjs/common";
import { SendGridEventDto } from "./sendgrid.dto";
import { publishDLR } from "../../../utils/rabbitmq/rabbitmq";

@Controller("webhook/sendgrid")
export class SendGridWebhookController {
  private readonly logger = new Logger("SendGridWebhook");

  @Post("event")
  @HttpCode(200)
  async receiveEvents(@Body() events: SendGridEventDto[]) {
    this.logger.log(`📩 SendGrid events received: ${events.length}`);

    for (const event of events) {
      await publishDLR("sendgrid", event);
    }

    return { success: true, received: events.length };
  }
}
