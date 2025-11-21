//
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SmsWorkerService } from "./sms.worker";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [SmsWorkerService],
})
export class SmsWorkerModule {}
