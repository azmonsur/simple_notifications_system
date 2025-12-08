import { Injectable } from "@nestjs/common";
import { query } from "../../utils/db/db";

@Injectable()
export class DlrAnalyticsService {
  /**
   * Build a WHERE clause for date filtering safely.
   * Expands the 'to' date to 23:59:59 to include full day.
   * @param from Start date (inclusive)
   * @param to End date (inclusive)
   * @param column Column to filter on (default: created_at)
   * @returns SQL WHERE clause
   */
  private buildDateFilter(
    from?: string,
    to?: string,
    column: string = "created_at"
  ): string {
    const conditions: string[] = [];

    if (from) conditions.push(`${column} >= '${from} 00:00:00'`);
    if (to) conditions.push(`${column} <= '${to} 23:59:59'`);

    return conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  }

  /** ------------------ PROVIDER ANALYSIS ------------------ **/

  // Total messages per provider
  async totalMessagesByProvider(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const result = await query(`
      SELECT provider, COUNT(*) AS total
      FROM webhook_logs
      ${dateFilter}
      GROUP BY provider
      ORDER BY provider;
    `);
    return result.rows;
  }

  // Delivered vs failed per provider
  async statusBreakdown(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const result = await query(`
      SELECT provider, status, COUNT(*) AS count
      FROM webhook_logs
      ${dateFilter}
      GROUP BY provider, status
      ORDER BY provider, status;
    `);
    return result.rows;
  }

  // Status breakdown per provider (Termii, SendGrid, WhatsApp Meta, etc.)
  async providerStatusBreakdown(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);

    const result = await query(`
    SELECT provider, status, COUNT(*) AS total
    FROM webhook_logs
    ${dateFilter}
    GROUP BY provider, status
    ORDER BY provider, status;
  `);

    return result.rows;
  }

  // Optional: Status percentage per provider
  async providerStatusPercentage(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);

    const result = await query(`
    SELECT 
      provider,
      status,
      COUNT(*) AS count,
      ROUND( (COUNT(*)::decimal / SUM(COUNT(*)) OVER (PARTITION BY provider)) * 100, 2 ) AS percentage
    FROM webhook_logs
    ${dateFilter}
    GROUP BY provider, status
    ORDER BY provider, status;
  `);

    return result.rows;
  }

  // Average retries per provider
  async averageRetries(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const result = await query(`
      SELECT provider, AVG(retries) AS avg_retries
      FROM webhook_logs
      ${dateFilter}
      GROUP BY provider
      ORDER BY provider;
    `);
    return result.rows;
  }

  // Total cost per provider (SMS only)
  async totalCost(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to, "sent_at");
    const whereClause = dateFilter
      ? `${dateFilter} AND cost IS NOT NULL`
      : "WHERE cost IS NOT NULL";

    const result = await query(`
      SELECT provider, SUM(cost) AS total_cost
      FROM webhook_logs
      ${whereClause}
      GROUP BY provider
      ORDER BY provider;
    `);
    return result.rows;
  }

  /** ------------------ CHANNEL ANALYSIS ------------------ **/

  // Total messages per channel
  async totalMessagesByChannel(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const result = await query(`
      SELECT channel, COUNT(*) AS total
      FROM webhook_logs
      ${dateFilter}
      GROUP BY channel
      ORDER BY channel;
    `);
    return result.rows;
  }

  // Status breakdown per channel
  async statusByChannel(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const result = await query(`
      SELECT channel, status, COUNT(*) AS count
      FROM webhook_logs
      ${dateFilter}
      GROUP BY channel, status
      ORDER BY channel, status;
    `);
    return result.rows;
  }

  /** ------------------ SUCCESS & TREND ANALYSIS ------------------ **/

  // Success rate per provider (DELIVERED / TOTAL)
  async successRate(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const result = await query(`
      SELECT provider,
        COUNT(*) FILTER (WHERE status ILIKE '%delivered%')::float / COUNT(*) AS success_rate
      FROM webhook_logs
      ${dateFilter}
      GROUP BY provider
      ORDER BY provider;
    `);
    return result.rows;
  }

  // Messages per day (trend)
  async messagesPerDay(from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);
    const result = await query(`
      SELECT DATE(created_at) AS day, COUNT(*) AS total
      FROM webhook_logs
      ${dateFilter}
      GROUP BY DATE(created_at)
      ORDER BY day;
    `);
    return result.rows;
  }

  /** ------------------ FULL ANALYSIS ------------------ **/

  async fullAnalysis(from?: string, to?: string) {
    const [
      total,
      status,
      retries,
      cost,
      byChannel,
      channelStatus,
      success,
      daily,
    ] = await Promise.all([
      this.totalMessagesByProvider(from, to),
      this.statusBreakdown(from, to),
      this.averageRetries(from, to),
      this.totalCost(from, to),
      this.totalMessagesByChannel(from, to),
      this.statusByChannel(from, to),
      this.successRate(from, to),
      this.messagesPerDay(from, to),
    ]);

    return {
      total,
      status,
      retries,
      cost,
      byChannel,
      channelStatus,
      success,
      daily,
    };
  }
}
