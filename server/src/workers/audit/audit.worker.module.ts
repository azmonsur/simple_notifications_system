import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { AuditLogService } from "./audit.worker";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [AuditLogService],
})
export class AuditLogWorkerModule {}
