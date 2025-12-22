import { ConfigModule } from "@nestjs/config";
import { Module } from "@nestjs/common";
import { AuditLogService } from "./audit.worker";
import { RedisModule } from "../../redis/redis.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RedisModule],
  providers: [AuditLogService],

  exports: [AuditLogService],
})
export class AuditLogWorkerModule {}
