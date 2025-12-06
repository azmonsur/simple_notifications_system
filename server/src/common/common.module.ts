import { Module } from "@nestjs/common";
import { RedisAuditService } from "./services/audit.service";
import { GlobalSchedulerService } from "./services/global-scheduler.service";

@Module({
  providers: [RedisAuditService, GlobalSchedulerService],
  exports: [RedisAuditService], // 👈 VERY IMPORTANT
})
export class CommonModule {}
