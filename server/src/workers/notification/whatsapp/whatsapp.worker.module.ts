import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { WhatsappWorkerService } from "./whatsapp.worker";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [WhatsappWorkerService],
})
export class WhatsappWorkerModule {}
