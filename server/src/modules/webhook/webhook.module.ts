import { Module } from "@nestjs/common";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";
import { AuthModule } from "../auth/auth.module"; // ✅ add this

@Module({
  imports: [AuthModule], // ✅ add this
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
