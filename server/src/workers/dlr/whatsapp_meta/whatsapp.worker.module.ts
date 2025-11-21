import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { WhatsAppDlrWorkerService } from "./whatsapp.worker";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [WhatsAppDlrWorkerService],
})
export class WhatsAppDlrWorkerModule {}
