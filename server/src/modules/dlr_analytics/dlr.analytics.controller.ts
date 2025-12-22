import { Controller, Get, Query } from "@nestjs/common";
import { DlrAnalyticsService } from "./dlr.analytics.service";
import { RedisRateLimit } from "../../common/guards/redis/redis-rate-limit.decorator";

@Controller("admin/dlr/analysis")
export class DlrAnalytcisController {
  constructor(private readonly analysisService: DlrAnalyticsService) {}

  // Full analysis
  @RedisRateLimit(20, 60)
  @Get("summary")
  async getFullAnalysis(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.fullAnalysis(from, to);
  }

  // Basic metrics
  @RedisRateLimit(20, 60)
  @Get("total")
  async getTotalMessages(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.totalMessagesByProvider(from, to);
  }

  @RedisRateLimit(20, 60)
  @Get("status")
  async getStatusBreakdown(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.statusBreakdown(from, to);
  }

  @RedisRateLimit(20, 60)
  @Get("retries")
  async getAverageRetries(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.averageRetries(from, to);
  }

  @RedisRateLimit(20, 60)
  @Get("cost")
  async getTotalCost(@Query("from") from?: string, @Query("to") to?: string) {
    return this.analysisService.totalCost(from, to);
  }

  // === CHANNEL ANALYSIS ===
  @RedisRateLimit(20, 60)
  @Get("channel")
  async getMessagesByChannel(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.totalMessagesByChannel(from, to);
  }

  @RedisRateLimit(20, 60)
  @Get("channel-status")
  async getStatusByChannel(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.analysisService.statusByChannel(from, to);
  }

  @RedisRateLimit(20, 60)
  @Get("provider-status")
  async providerStatus(@Query("from") from?: string, @Query("to") to?: string) {
    const data = await this.analysisService.providerStatusBreakdown(from, to);
    return { success: true, data };
  }

  @RedisRateLimit(20, 60)
  @Get("provider-status-percentage")
  async providerStatusPercentage(
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.analysisService.providerStatusPercentage(from, to);
    return { success: true, data };
  }

  // === SUCCESS RATE ===
  @RedisRateLimit(20, 60)
  @Get("success-rate")
  async getSuccessRate(@Query("from") from?: string, @Query("to") to?: string) {
    return this.analysisService.successRate(from, to);
  }

  // === TREND ===
  @RedisRateLimit(20, 60)
  @Get("daily-trend")
  async getDailyTrend(@Query("from") from?: string, @Query("to") to?: string) {
    return this.analysisService.messagesPerDay(from, to);
  }
}
