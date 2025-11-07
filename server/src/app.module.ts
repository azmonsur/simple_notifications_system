// src/app.module.ts
import { Module } from "@nestjs/common";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AdminModule } from "./admin/admin.module";

@Module({
  imports: [AdminModule, NotificationsModule, AnalyticsModule, AuthModule],
})
export class AppModule {}
