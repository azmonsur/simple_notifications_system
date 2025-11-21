import { Controller, Post, Body, HttpCode, Logger } from "@nestjs/common";
// import { WhatsAppDLRDto } from "./whatsapp.dto";
import { publishDLR } from "../../../utils/rabbitmq";

@Controller("webhook/whatsapp")
export class WhatsAppWebhookController {
  private readonly logger = new Logger("WhatsAppWebhook");

  @Post("status")
  @HttpCode(200)
  async receiveStatus(@Body() data: any) {
    this.logger.log(`📩 WhatsApp Status Event: ${JSON.stringify(data)}`);

    await publishDLR("whatsapp_meta", data);

    return { success: true };
  }
}
