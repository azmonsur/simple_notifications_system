// src/analytics/analytics.controller.ts
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Throttle } from "@nestjs/throttler";
import { RedisRateLimit } from "../../common/guards/redis/redis-rate-limit.decorator";

@Controller("admin/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @RedisRateLimit(20, 60)
  @Get("notifications/summary")
  async getNotificationSummary(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getNotificationSummary(from, to),
    };
  }

  @RedisRateLimit(20, 60)
  @Get("notifications/sent-this-month")
  async getNotificationSentThisMonth() {
    // ⚠ This endpoint is month-based and does not accept date filters
    return { data: await this.analyticsService.getNotificationSentThisMonth() };
  }

  @RedisRateLimit(20, 60)
  @Get("notifications/channel-status")
  async getNotificationsByChannelAndStatus(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getNotificationsByChannelAndStatus(
        from,
        to
      ),
    };
  }

  @RedisRateLimit(20, 60)
  @Get("notifications/channel-status-dash")
  async getNotificationsByChannelAndStatusDash(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getNotificationsByChannelAndStatusDash(
        from,
        to
      ),
    };
  }

  @RedisRateLimit(20, 60)
  @Get("notifications/channel")
  async getNotificationsByChannel(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getNotificationsByChannel(from, to),
    };
  }

  @RedisRateLimit(20, 60)
  @Get("notifications/recipient-role")
  async getNotificationsByRecipientRole(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getNotificationsByRecipientRole(
        from,
        to
      ),
    };
  }

  @RedisRateLimit(20, 60)
  @Get("parcels/status")
  async getParcelsByStatus(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return { data: await this.analyticsService.getParcelsByStatus(from, to) };
  }

  @RedisRateLimit(20, 60)
  @Get("parcels/average-duration")
  async getAverageParcelDuration(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getAverageParcelDuration(from, to),
    };
  }

  @RedisRateLimit(20, 60)
  @Get("parcels/transitions")
  async getParcelStatusTransitionCounts(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getParcelStatusTransitionCounts(
        from,
        to
      ),
    };
  }

  @RedisRateLimit(20, 60)
  @Get("notifications/avg-per-parcel")
  async getAvgNotificationsPerParcel(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getAvgNotificationsPerParcel(from, to),
    };
  }

  @RedisRateLimit(20, 60)
  @Get("parcels/total")
  async getTotalParcels(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return { data: await this.analyticsService.getTotalParcels(from, to) };
  }
}
