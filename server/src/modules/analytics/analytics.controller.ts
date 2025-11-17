// src/analytics/analytics.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/jwt.guard";
import { Throttle } from "@nestjs/throttler";

// @UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 100, ttl: 60 } }) // max 100 requests per IP per 60 seconds
@Controller("api/v1/admin/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("notifications/summary")
  async getNotificationSummary() {
    return { data: await this.analyticsService.getNotificationSummary() };
  }

  @Get("notifications/sent-this-month")
  async getNotificationSentThisMonth() {
    return { data: await this.analyticsService.getNotificationSentThisMonth() };
  }

  @Get("notifications/channel-status")
  async getNotificationsByChannelAndStatus() {
    return {
      data: await this.analyticsService.getNotificationsByChannelAndStatus(),
    };
  }

  @Get("notifications/channel-status-dash")
  async getNotificationsByChannelAndStatusDash() {
    return {
      data: await this.analyticsService.getNotificationsByChannelAndStatusDash(),
    };
  }

  @Get("notifications/channel")
  async getNotificationsByChannel() {
    return { data: await this.analyticsService.getNotificationsByChannel() };
  }

  @Get("notifications/recipient-role")
  async getNotificationsByRecipientRole() {
    return {
      data: await this.analyticsService.getNotificationsByRecipientRole(),
    };
  }

  @Get("parcels/status")
  async getParcelsByStatus() {
    return { data: await this.analyticsService.getParcelsByStatus() };
  }

  @Get("parcels/average-duration")
  async getAverageParcelDuration() {
    return { data: await this.analyticsService.getAverageParcelDuration() };
  }

  @Get("parcels/transitions")
  async getParcelStatusTransitionCounts() {
    return {
      data: await this.analyticsService.getParcelStatusTransitionCounts(),
    };
  }

  @Get("notifications/avg-per-parcel")
  async getAvgNotificationsPerParcel() {
    return { data: await this.analyticsService.getAvgNotificationsPerParcel() };
  }

  @Get("parcels/total")
  async getTotalParcels() {
    return { data: await this.analyticsService.getTotalParcels() };
  }
}
