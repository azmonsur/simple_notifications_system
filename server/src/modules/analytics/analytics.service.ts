// src/analytics/analytics.service.ts
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Pool } from "pg";
import { query as dbQuery } from "../../utils/db";

@Injectable()
export class AnalyticsService {
  // 1️⃣ Notification summary (sent, queued, failed)
  async getNotificationSummary() {
    try {
      const res = await dbQuery(`
        SELECT 
          status,
          COUNT(*)::int AS total
        FROM notifications
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

  // src/analytics/analytics.service.ts
  async getNotificationsByChannelAndStatus() {
    try {
      const res = await dbQuery(`
      SELECT 
        channel,
        status,
        COUNT(*)::int AS total
      FROM notifications
      GROUP BY channel, status
      ORDER BY channel, status;
    `);

      // Transform the rows into grouped structure
      const grouped: Record<string, any> = {};
      res.rows.forEach((row) => {
        const { channel, status, total } = row;
        if (!grouped[channel])
          grouped[channel] = {
            channel,
            sent: 0,
            queued: 0,
            failed: 0,
            total: 0,
          };
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

  // Add this in analytics.service.ts
  async getNotificationsByChannelAndStatusDash() {
    try {
      const res = await dbQuery(`
      SELECT 
        channel,
        status,
        COUNT(*)::int AS total
      FROM notifications
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

  // 2️⃣ Total notifications per channel
  async getNotificationsByChannel() {
    try {
      const res = await dbQuery(`
        SELECT 
          channel,
          COUNT(*)::int AS total
        FROM notifications
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

  // 3️⃣ Total notifications per recipient role
  async getNotificationsByRecipientRole() {
    try {
      const res = await dbQuery(`
        SELECT 
          recipient_role,
          COUNT(*)::int AS total
        FROM notifications
        GROUP BY recipient_role;
      `);
      return res.rows;
    } catch (err) {
      throw new InternalServerErrorException(
        "Failed to fetch recipient role stats"
      );
    }
  }

  // 4️⃣ Parcels summary by current_status
  async getParcelsByStatus() {
    try {
      const res = await dbQuery(`
         SELECT 
          new_status,
          COUNT(*)::int AS total
        FROM parcel_history
        GROUP BY new_status
        ORDER BY new_status;
      `);
      return res.rows;
    } catch (err) {
      throw new InternalServerErrorException("Failed to fetch parcel summary");
    }
  }

  // 5️⃣ Average time (in hours) per parcel from first to last status
  async getAverageParcelDuration() {
    try {
      const res = await dbQuery(`
        WITH parcel_durations AS (
          SELECT 
            parcel_id,
            EXTRACT(EPOCH FROM (MAX(changed_at) - MIN(changed_at))) / 3600 AS hours_duration
          FROM parcel_history
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

  // 6️⃣ Parcel transitions count (how many times each status occurred)
  async getParcelStatusTransitionCounts() {
    try {
      const res = await dbQuery(`
        SELECT 
          new_status,
          COUNT(*)::int AS transitions
        FROM parcel_history
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

  // 7️⃣ Average number of notifications per parcel
  async getAvgNotificationsPerParcel() {
    try {
      const res = await dbQuery(`
        SELECT 
          ROUND(AVG(cnt)::numeric, 2) AS avg_notif_per_parcel
        FROM (
          SELECT parcel_id, COUNT(*) AS cnt
          FROM notifications
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

  // 8️⃣ Total parcels handled (for overall metric)
  async getTotalParcels() {
    try {
      const res = await dbQuery(`SELECT COUNT(*)::int AS total FROM parcels;`);
      return res.rows[0];
    } catch (err) {
      throw new InternalServerErrorException("Failed to get total parcels");
    }
  }
}
