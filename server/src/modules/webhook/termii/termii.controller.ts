import { Controller, Post, Body, HttpCode, Logger } from "@nestjs/common";
import { TermiiDLRDto } from "./termii.dto";
import { publishDLR } from "../../../utils/rabbitmq/rabbitmq";
import { RedisRateLimit } from "../../../common/guards/redis/redis-rate-limit.decorator";
import { Public } from "../../../common/decorators/public.decorator";

@Public()
@Controller("webhook/termii")
export class TermiiWebhookController {
  private readonly logger = new Logger("TermiiWebhook");

  @RedisRateLimit(30, 60)
  @Post("dlr")
  @HttpCode(200)
  async receiveDLR(@Body() data: TermiiDLRDto) {
    this.logger.log(`📩 Termii DLR received: ${JSON.stringify(data)}`);

    // Push to queue
    await publishDLR("termii", data);

    // Always reply 200 to Termii
    return { success: true };
  }
}
