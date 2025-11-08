import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";

import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { UserModule } from "./modules/users/user.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { LoggingThrottlerGuard } from "./guards/logging-throttler.guard";

@Module({
  imports: [
    // ✅ ThrottlerModule with global options
    ThrottlerModule.forRoot([
      {
        ttl: 60, // time window in seconds
        limit: 200, // max requests per IP in that window
      },
    ]),

    PrometheusModule.register(),

    AdminModule,
    NotificationsModule,
    AnalyticsModule,
    AuthModule,
    UserModule,
  ],
  providers: [
    // ✅ Apply LoggingThrottlerGuard globally
    {
      provide: APP_GUARD,
      useClass: LoggingThrottlerGuard,
    },
  ],
})
export class AppModule {}
