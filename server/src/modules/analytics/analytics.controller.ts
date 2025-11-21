// src/analytics/analytics.controller.ts
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Throttle } from "@nestjs/throttler";

@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 100, ttl: 60 } }) // max 100 requests per IP per 60 seconds
@Controller("api/v1/admin/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("notifications/summary")
  async getNotificationSummary(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getNotificationSummary(from, to),
    };
  }

  @Get("notifications/sent-this-month")
  async getNotificationSentThisMonth() {
    // ⚠ This endpoint is month-based and does not accept date filters
    return { data: await this.analyticsService.getNotificationSentThisMonth() };
  }

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

  @Get("notifications/channel")
  async getNotificationsByChannel(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getNotificationsByChannel(from, to),
    };
  }

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

  @Get("parcels/status")
  async getParcelsByStatus(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return { data: await this.analyticsService.getParcelsByStatus(from, to) };
  }

  @Get("parcels/average-duration")
  async getAverageParcelDuration(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getAverageParcelDuration(from, to),
    };
  }

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

  @Get("notifications/avg-per-parcel")
  async getAvgNotificationsPerParcel(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return {
      data: await this.analyticsService.getAvgNotificationsPerParcel(from, to),
    };
  }

  @Get("parcels/total")
  async getTotalParcels(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return { data: await this.analyticsService.getTotalParcels(from, to) };
  }
}
