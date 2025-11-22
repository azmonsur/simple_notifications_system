import { Controller, Get, Query } from "@nestjs/common";
import { DlrAnalyticsService } from "./dlr.analytics.service";

@Controller("admin/dlr/analysis")
export class DlrAnalytcisController {
  constructor(private readonly analysisService: DlrAnalyticsService) {}

  // Full analysis
  @Get("summary")
  async getFullAnalysis(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.fullAnalysis(from, to);
  }

  // Basic metrics
  @Get("total")
  async getTotalMessages(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.totalMessagesByProvider(from, to);
  }

  @Get("status")
  async getStatusBreakdown(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.statusBreakdown(from, to);
  }

  @Get("retries")
  async getAverageRetries(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.averageRetries(from, to);
  }

  @Get("cost")
  async getTotalCost(@Query("from") from?: string, @Query("to") to?: string) {
    return this.analysisService.totalCost(from, to);
  }

  // === CHANNEL ANALYSIS ===
  @Get("channel")
  async getMessagesByChannel(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.totalMessagesByChannel(from, to);
  }

  @Get("channel-status")
  async getStatusByChannel(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.statusByChannel(from, to);
  }

  @Get("provider-status")
  async providerStatus(@Query("from") from?: string, @Query("to") to?: string) {
    const data = await this.analysisService.providerStatusBreakdown(from, to);
    return { success: true, data };
  }

  @Get("provider-status-percentage")
  async providerStatusPercentage(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.analysisService.providerStatusPercentage(from, to);
    return { success: true, data };
  }

  // === SUCCESS RATE ===
  @Get("success-rate")
  async getSuccessRate(@Query("from") from?: string, @Query("to") to?: string) {
    return this.analysisService.successRate(from, to);
  }

  // === TREND ===
  @Get("daily-trend")
  async getDailyTrend(@Query("from") from?: string, @Query("to") to?: string) {
    return this.analysisService.messagesPerDay(from, to);
  }
}
