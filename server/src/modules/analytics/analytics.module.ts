import { Module } from "@nestjs/common";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { AuthModule } from "../auth/auth.module"; // ✅ add this

@Module({
  imports: [AuthModule], // ✅ add this
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
