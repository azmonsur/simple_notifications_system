import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";

import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { UserModule } from "./modules/users/user.module";
import { AuthModule } from "./modules/auth/auth.module";
import { RedisModule } from "./redis/redis.module";
import { WebhookModule } from "./modules/webhook/webhook.module";
import { HealthModule } from "./modules/health/health.module";
import { CommonModule } from "./common/common.module";
import { DlrAnalyticsModule } from "./modules/dlr_analytics/dlr.analytics.module";
import { AdminModule } from "./admin/admin.module";
import { ApiKeyMiddleware } from "./middleware/api-key.middleware";
import { RedisRateLimitGuard } from "./common/guards/redis/redis-rate-limit.guard";
import { JwtAuthGuard } from "./modules/auth/jwt.guard";

@Module({
  imports: [
    // ✅ ThrottlerModule with global options
    ThrottlerModule.forRoot([
      {
        ttl: 60, // time window in seconds
        limit: 10, // max requests per IP in that window
      },
    ]),

    PrometheusModule.register(),

    AdminModule,
    NotificationsModule,
    AnalyticsModule,
    AuthModule,
    WebhookModule,
    DlrAnalyticsModule,
    UserModule,
    CommonModule,
    HealthModule,
    RedisModule,
  ],
  providers: [
    // ✅ Apply LoggingThrottlerGuard globally
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RedisRateLimitGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // ✅ Apply API key middleware only for notifications routes
    consumer.apply(ApiKeyMiddleware).forRoutes("notification"); // <-- adjust path if different
  }
}
