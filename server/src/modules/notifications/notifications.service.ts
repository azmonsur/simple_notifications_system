// src/notifications/notifications.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";

import { Pool } from "pg";
import { encryptDestination } from "./utils/crypto";
import { publishDelivery, getChannel } from "../../utils/rabbitmq";
import { CreateNotificationDto } from "./dto/notifications.dto";
import { query as dbQuery } from "../../utils/db";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://notif:notifpass@localhost:5432/notifications",
});

@Injectable()
export class NotificationsService {
  private logger = new Logger("NotificationsService");
  /**
   * Create or update parcels and generate notifications
   */
  async createFromEvent(event: CreateNotificationDto, ip: string) {
    if (!event?.payload) {
      console.error("❌ Invalid event: missing payload");
      throw new InternalServerErrorException("Missing event payload");
    }

    const {
      tracking_number,
      parcel_status,
      amount,
      origin_center,
      destination_center,
      sender,
      receiver,
    } = event.payload;

    let parcelId: string;

    // --- Upsert parcel and get parcelId
    try {
      const res = await dbQuery(
        `INSERT INTO parcels (
        tracking_number, sender_name, sender_phone, sender_email,
        receiver_name, receiver_phone, receiver_email, amount, current_status,
        origin_center, destination_center
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (tracking_number) 
      DO UPDATE SET
        sender_name = EXCLUDED.sender_name,
        sender_phone = EXCLUDED.sender_phone,
        sender_email = EXCLUDED.sender_email,
        receiver_name = EXCLUDED.receiver_name,
        receiver_phone = EXCLUDED.receiver_phone,
        receiver_email = EXCLUDED.receiver_email,
        amount = EXCLUDED.amount,
        current_status = EXCLUDED.current_status,
        origin_center = EXCLUDED.origin_center,
        destination_center = EXCLUDED.destination_center,
        updated_at = now()
      RETURNING id, current_status`,
        [
          tracking_number,
          sender.name,
          sender.phone,
          sender.email,
          receiver.name,
          receiver.phone,
          receiver.email,
          amount ?? null,
          parcel_status,
          origin_center,
          destination_center,
        ]
      );
      parcelId = res.rows[0].id;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Parcel DB operation failed: ${errMsg}`);
      this.logger.error(`Webhook error from IP ${ip || "unknown"}: ${errMsg}`);
      throw new InternalServerErrorException("Parcel DB operation failed");
    }

    // --- Check if status already exists in parcel_history
    let last_status: string;
    try {
      const historyRes = await dbQuery(
        `SELECT new_status, changed_at FROM parcel_history WHERE parcel_id = $1 order by changed_at desc`,
        [parcelId]
      );

      const existingStatuses = historyRes.rows.map((r) => r.new_status);

      if (existingStatuses.includes(parcel_status)) {
        console.log(
          `ℹ️ Status "${parcel_status}" already exists for parcel ${tracking_number}. Skipping history & notifications.`
        );
        return; // Exit without inserting notifications
      }

      last_status = existingStatuses[0];
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed to check parcel history: ${errMsg}`);
      throw new InternalServerErrorException("Parcel history check failed");
    }

    // --- Insert new parcel_history record
    try {
      await dbQuery(
        `INSERT INTO parcel_history (parcel_id, old_status, new_status, changed_by)
       VALUES ($1, $2, $3, $4)`,
        [parcelId, last_status, parcel_status, "system"]
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Parcel history insertion failed: ${errMsg}`);
    }

    // --- Generate notifications for each recipient & channel
    const recipients = [
      { role: "sender", ...sender },
      { role: "receiver", ...receiver },
    ];

    for (const r of recipients) {
      const channels = r.preferred_channels?.length
        ? r.preferred_channels
        : ["sms"];

      for (const ch of channels) {
        const destination = ch === "email" ? r.email || "" : r.phone || "";
        if (!destination) continue;

        try {
          const encrypted = encryptDestination(destination);

          let postOfficeCenter: string | null = null;
          if (
            (r.role === "sender" && parcel_status === "pending") ||
            (r.role === "receiver" && parcel_status === "dispatched") ||
            (r.role === "receiver" && parcel_status === "arrived") ||
            (r.role === "sender" && parcel_status === "arrived")
          ) {
            postOfficeCenter =
              parcel_status === "pending"
                ? origin_center ?? null
                : destination_center ?? null;
          }

          const notifRes = await dbQuery(
            `INSERT INTO notifications (
            parcel_id, channel, recipient_role, recipient_name, recipient_destination,
            template_vars, status, attempts, post_office_center
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING *`,
            [
              parcelId,
              ch,
              r.role,
              r.name,
              encrypted,
              JSON.stringify({
                name: r.name,
                status: parcel_status,
                tracking_number,
                amount: amount ?? null,
              }),
              "queued",
              0,
              postOfficeCenter,
            ]
          );

          const notif = notifRes.rows[0];

          await publishDelivery({
            notif_id: notif.id,
            parcel_id: parcelId,
            channel: ch,
            post_office_center: postOfficeCenter,
            recipient: {
              name: r.name,
              role: r.role,
              destination,
            },
            template_vars: {
              tracking_number,
              status: parcel_status,
              amount: amount ?? null,
            },
            created_at: new Date().toISOString(),
          });

          console.log(`✅ Notification created & published: ${notif.id}`);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(
            `❌ Notification failed for ${r.role} via ${ch}: ${errMsg}`
          );
        }
      }
    }
  }

  // --- List failed notifications
  async listFailed(limit = 100) {
    try {
      const res = await dbQuery(
        `SELECT id, parcel_id, channel, recipient_role, recipient_name, recipient_destination, last_error, attempts, created_at
         FROM notifications
         WHERE status = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        ["failed", limit]
      );
      return res.rows;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("❌ Error fetching failed notifications:", errMsg);
      throw new InternalServerErrorException("Database query failed");
    }
  }

  // --- Mark notification as queued, republish, and remove from DLQ
  async markQueued(id: string) {
    try {
      const res = await dbQuery(
        "SELECT * FROM notifications WHERE id=$1 and status=$2",
        [id, "failed"]
      );
      const notif = res.rows[0];
      if (!notif) {
        console.error("⚠️ Notification not found or not failed");
        return;
      }

      await dbQuery(
        "UPDATE notifications SET status=$1, attempts=0, updated_at=now() WHERE id=$2",
        ["queued", id]
      );

      await publishDelivery({
        notif_id: id,
        parcel_id: notif.parcel_id,
        channel: notif.channel,
        post_office_center: notif.post_office_center,
        recipient: {
          name: notif.recipient_name,
          role: notif.recipient_role,
          destination: notif.recipient_destination,
        },
        template_vars:
          typeof notif.template_vars === "string"
            ? JSON.parse(notif.template_vars)
            : notif.template_vars,
        created_at: new Date().toISOString(),
      });

      // ✅ Remove message from DLQ (create a normal non-confirm channel)
      const amqp = require("amqplib");
      const connection = await amqp.connect(
        process.env.RABBITMQ_URL || "amqp://localhost"
      );
      const channel = await connection.createChannel();

      const dlqName = `notifications.${notif.channel}.dlq`;
      await channel.assertQueue(dlqName, { durable: true });

      const msg = await channel.get(dlqName, { noAck: false });
      if (msg) {
        channel.ack(msg);
        console.log(`🧹 Removed 1 message from DLQ: ${dlqName}`);
      } else {
        console.log(`ℹ️ No message found in DLQ: ${dlqName}`);
      }

      await channel.close();
      await connection.close();

      console.log(`✅ Notification ${id} requeued successfully`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ markQueued failed: ${errMsg}`);
      await dbQuery(
        "UPDATE notifications SET status=$1, attempts=0, updated_at=now() WHERE id=$2",
        ["failed", id]
      );
      throw new InternalServerErrorException("Database update failed");
    }
  }

  // --- Mark notification as resolved
  async markResolved(id: string) {
    try {
      await dbQuery(
        "UPDATE notifications SET status=$1, updated_at=now() WHERE id=$2",
        ["resolved", id]
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ markResolved failed: ${errMsg}`);
      throw new InternalServerErrorException("Database update failed");
    }
  }
}
