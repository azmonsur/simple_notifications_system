import {
  Controller,
  Post,
  Body,
  HttpCode,
  Logger,
  Get,
  Query,
  ForbiddenException,
} from "@nestjs/common";
// import { WhatsAppDLRDto } from "./whatsapp.dto";
import { publishDLR } from "../../../utils/rabbitmq";
import { logger } from "../../../utils/logger";

@Controller("webhook/whatsapp")
export class WhatsAppWebhookController {
  @Post("status")
  @HttpCode(200)
  async receiveStatus(@Body() data: any) {
    logger.info(`📩 WhatsApp Status Event: ${JSON.stringify(data)}`);

    await publishDLR("whatsapp_meta", data);
    console.log(data);
    return { success: true };
  }

  // --- 2. GET Endpoint for Webhook Verification ---
  @Get("status")
  async verifyWebhook(
    @Query("hub.mode") mode: string,
    @Query("hub.challenge") challenge: string,
    @Query("hub.verify_token") token: string
  ): Promise<string> {
    logger.info(`Attempting WhatsApp Webhook verification...`);

    // 1. Check if the mode is 'subscribe'
    // 2. Check if the token matches your SECRET
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      logger.info("✅ Webhook Verified!");

      // Send the challenge string back to Meta to complete verification
      return challenge;
    }

    logger.error("❌ Webhook Verification Failed: Invalid mode or token.");
    // Throw a 403 Forbidden if verification fails
    throw new ForbiddenException("Webhook verification failed.");
  }
}
