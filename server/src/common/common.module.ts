import { Module } from "@nestjs/common";
import { RedisAuditService } from "./services/audit.service";

@Module({
  providers: [RedisAuditService],
  exports: [RedisAuditService], // 👈 VERY IMPORTANT
})
export class CommonModule {}
