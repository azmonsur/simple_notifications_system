// src/analytics/analytics.controller.ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { JwtAuthGuard } from "../auth/jwt.guard";

@UseGuards(JwtAuthGuard)
@Controller("api/v1/admin/analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("notifications/summary")
  async getNotificationSummary() {
    return { data: await this.analyticsService.getNotificationSummary() };
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
