import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { TermiiDlrWorkerService } from "./termii.worker";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [TermiiDlrWorkerService],
})
export class TermiiDlrWorkerModule {}
