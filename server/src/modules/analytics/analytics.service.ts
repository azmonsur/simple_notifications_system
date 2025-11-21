// src/analytics/analytics.service.ts

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { query as dbQuery } from "../../utils/db";

@Injectable()
export class AnalyticsService {
  /**
   * Build WHERE clause for date filtering.
   * Expands end date to 23:59:59.
   */
  private buildDateFilter(
    from?: string,
    to?: string,
    column: string = "created_at"
  ): string {
    const parts: string[] = [];

    if (from) parts.push(`${column} >= '${from} 00:00:00'`);
    if (to) parts.push(`${column} <= '${to} 23:59:59'`);

    return parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  }

  // -------------------------------------------------------------
  // 1️⃣ Notification summary (sent, queued, failed)
  // -------------------------------------------------------------
  async getNotificationSummary(from?: string, to?: string) {
    try {
      const filter = this.buildDateFilter(from, to);

      const res = await dbQuery(`
        SELECT 
          status,
          COUNT(*)::int AS total
        FROM notifications
        ${filter}
        GROUP BY status
        ORDER BY status DESC;
      `);

      return res.rows;
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to fetch notification summary"
      );
    }
  }

  async getNotificationSentThisMonth() {
    try {
      const res = await dbQuery(`
        SELECT COUNT(y.status)::int AS sent_this_month 
        FROM parcels x 
        RIGHT JOIN notifications y ON x.id = y.parcel_id 
        WHERE x.updated_at >= DATE_TRUNC('month', CURRENT_DATE) 
        AND x.updated_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' 
        AND y.status = 'sent';
      `);
      return res.rows;
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to fetch notification sent this month"
      );
    }
  }

  // -------------------------------------------------------------
  // Channel + Status Summary
  // -------------------------------------------------------------
  async getNotificationsByChannelAndStatus(from?: string, to?: string) {
    try {
      const filter = this.buildDateFilter(from, to);

      const res = await dbQuery(`
        SELECT 
          channel,
          status,
          COUNT(*)::int AS total
        FROM notifications
        ${filter}
        GROUP BY channel, status
        ORDER BY channel, status;
      `);

      const grouped: Record<string, any> = {};

      res.rows.forEach((row) => {
        const { channel, status, total } = row;

        if (!grouped[channel]) {
          grouped[channel] = {
            channel,
            sent: 0,
            queued: 0,
            failed: 0,
            total: 0,
          };
        }

        grouped[channel][status] = total;
        grouped[channel].total += total;
      });

      return Object.values(grouped);
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to fetch channel-by-status analytics"
      );
    }
  }

  async getNotificationsByChannelAndStatusDash(from?: string, to?: string) {
    try {
      const filter = this.buildDateFilter(from, to);

      const res = await dbQuery(`
        SELECT 
          channel,
          status,
          COUNT(*)::int AS total
        FROM notifications
        ${filter}
        GROUP BY channel, status
        ORDER BY channel, status;
      `);

      return res.rows;
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to fetch detailed channel analytics"
      );
    }
  }

  // -------------------------------------------------------------
  // Total notifications per channel
  // -------------------------------------------------------------
  async getNotificationsByChannel(from?: string, to?: string) {
    try {
      const filter = this.buildDateFilter(from, to);

      const res = await dbQuery(`
        SELECT 
          channel,
          COUNT(*)::int AS total
        FROM notifications
        ${filter}
        GROUP BY channel
        ORDER BY channel;
      `);

      return res.rows;
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to fetch channel analytics"
      );
    }
  }

  // -------------------------------------------------------------
  // Total notifications by recipient role
  // -------------------------------------------------------------
  async getNotificationsByRecipientRole(from?: string, to?: string) {
    try {
      const filter = this.buildDateFilter(from, to);

      const res = await dbQuery(`
        SELECT 
          recipient_role,
          COUNT(*)::int AS total
        FROM notifications
        ${filter}
        GROUP BY recipient_role;
      `);

      return res.rows;
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to fetch recipient role stats"
      );
    }
  }

  // -------------------------------------------------------------
  // Parcel summary by new_status
  // -------------------------------------------------------------
  async getParcelsByStatus(from?: string, to?: string) {
    try {
      const filter = this.buildDateFilter(from, to, "changed_at");

      const res = await dbQuery(`
        SELECT 
          new_status,
          COUNT(*)::int AS total
        FROM parcel_history
        ${filter}
        GROUP BY new_status
        ORDER BY new_status;
      `);

      return res.rows;
    } catch (err) {
      throw new InternalServerErrorException("Failed to fetch parcel summary");
    }
  }

  // -------------------------------------------------------------
  // Average time per parcel
  // -------------------------------------------------------------
  async getAverageParcelDuration(from?: string, to?: string) {
    try {
      const filter = this.buildDateFilter(from, to, "changed_at");

      const res = await dbQuery(`
        WITH parcel_durations AS (
          SELECT 
            parcel_id,
            EXTRACT(EPOCH FROM (MAX(changed_at) - MIN(changed_at))) / 3600 AS hours_duration
          FROM parcel_history
          ${filter}
          GROUP BY parcel_id
        )
        SELECT 
          ROUND(AVG(hours_duration)::numeric, 2) AS avg_hours_per_parcel
        FROM parcel_durations;
      `);

      return res.rows[0] || { avg_hours_per_parcel: 0 };
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to calculate average parcel duration"
      );
    }
  }

  // -------------------------------------------------------------
  // Parcel status transition counts
  // -------------------------------------------------------------
  async getParcelStatusTransitionCounts(from?: string, to?: string) {
    try {
      const filter = this.buildDateFilter(from, to, "changed_at");

      const res = await dbQuery(`
        SELECT 
          new_status,
          COUNT(*)::int AS transitions
        FROM parcel_history
        ${filter}
        GROUP BY new_status
        ORDER BY transitions DESC;
      `);

      return res.rows;
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to fetch parcel status transitions"
      );
    }
  }

  // -------------------------------------------------------------
  // Average notifications per parcel
  // -------------------------------------------------------------
  async getAvgNotificationsPerParcel(from?: string, to?: string) {
    try {
      const filter = this.buildDateFilter(from, to);

      const res = await dbQuery(`
        SELECT 
          ROUND(AVG(cnt)::numeric, 2) AS avg_notif_per_parcel
        FROM (
          SELECT parcel_id, COUNT(*) AS cnt
          FROM notifications
          ${filter}
          GROUP BY parcel_id
        ) AS sub;
      `);

      return res.rows[0] || { avg_notif_per_parcel: 0 };
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to calculate avg notifications per parcel"
      );
    }
  }

  // -------------------------------------------------------------
  // Total parcels
  // -------------------------------------------------------------
  async getTotalParcels(from?: string, to?: string) {
    try {
      // parcels table uses created_at
      const filter = this.buildDateFilter(from, to);

      const res = await dbQuery(`
        SELECT COUNT(*)::int AS total 
        FROM parcels
        ${filter};
      `);

      return res.rows[0];
    } catch (err) {
      throw new InternalServerErrorException("Failed to get total parcels");
    }
  }
}
