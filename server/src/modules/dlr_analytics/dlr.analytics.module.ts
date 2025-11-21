import { Module } from "@nestjs/common";
import { DlrAnalyticsService } from "./dlr.analytics.service";
import { DlrAnalytcisController } from "./dlr.analytics.controller";

@Module({
  providers: [DlrAnalyticsService],
  controllers: [DlrAnalytcisController],
})
export class DlrAnalyticsModule {}
