import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { SendGridDlrWorkerService } from "./sendgrid.worker";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [SendGridDlrWorkerService],
})
export class SendGridDlrWorkerModule {}
