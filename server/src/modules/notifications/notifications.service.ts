// src/notifications/notifications.service.ts
import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  HttpException,
  NotFoundException,
} from "@nestjs/common";

import { QueryResult, PoolClient } from "pg";
import { encryptDestination, decryptDestination } from "./utils/crypto";
import {
  publishDelivery,
  getChannel,
  publishRequeue,
} from "../../utils/rabbitmq";
import { CreateNotificationDto } from "./dto/notifications.dto";
import { query as dbQuery, pool } from "../../utils/db";
import { logger } from "../../utils/logger";

// import amqp from "amqplib";
const amqp = require("amqplib");

@Injectable()
export class NotificationsService {
  /**
   * Helper to run transactional operations
   */
  private async withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Create or update parcels and generate notifications
   */
  async createFromEvent(
    event: CreateNotificationDto,

    ip: string
  ) {
    if (!event?.payload) {
      logger.error("❌ Invalid event: missing payload");
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

    try {
      await this.withTransaction(async (client) => {
        // --- Upsert parcel
        const parcelRes: QueryResult<{ id: string }> = await client.query(
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
          RETURNING id`,
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

        const parcelId = parcelRes.rows[0].id;

        // --- Check history
        const historyRes = await client.query(
          `SELECT new_status FROM parcel_history WHERE parcel_id = $1 ORDER BY changed_at DESC`,
          [parcelId]
        );
        const existingStatuses = historyRes.rows.map((r) => r.new_status);

        if (
          existingStatuses
            .map((status) => status.toLowerCase())
            .includes(parcel_status)
        ) {
          console.log(
            `ℹ️ Status "${parcel_status}" already exists for parcel ${tracking_number}. Skipping history & notifications.`
          );

          throw new ConflictException({
            message: `Parcel already has status '${parcel_status}'`,
          });
        }

        const last_status = existingStatuses[0] ?? null;

        // --- Insert history
        await client.query(
          `INSERT INTO parcel_history (parcel_id, old_status, new_status, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [parcelId, last_status, parcel_status, "system"]
        );

        // --- Generate notifications
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

            const notifRes: QueryResult<{ id: string }> = await client.query(
              `INSERT INTO notifications (
                parcel_id, channel, recipient_role, recipient_name, recipient_destination,
                template_vars, status, attempts, post_office_center
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
              RETURNING id`,
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

            let attachments = undefined;
            if (["email", "whatsapp"].includes(ch)) {
              attachments = [
                {
                  filename: `receipt_${tracking_number}.pdf`,
                  content: "",
                  type: "application/pdf",
                },
              ];
            }

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
              attachments,
              created_at: new Date().toISOString(),
            });

            logger.info(`✅ Notification created & published: ${notif.id}`);
          }
        }
      });
    } catch (err: unknown) {
      if (err instanceof HttpException) {
        throw err;
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`❌ createFromEvent failed: ${errMsg}`);
      throw new InternalServerErrorException("Event processing failed");
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
      logger.error("❌ Error fetching failed notifications:", errMsg);
      throw new InternalServerErrorException("Database query failed");
    }
  }

  // --- Mark notification as queued
  async markQueued(id: string) {
    try {
      await dbQuery("BEGIN");

      // 1️⃣ Fetch the notification for update
      const res: QueryResult = await dbQuery(
        `SELECT * FROM notifications WHERE id=$1 AND status=$2 FOR UPDATE`,
        [id, "failed"]
      );

      const notif = res.rows[0];
      if (!notif) {
        await dbQuery("ROLLBACK");
        throw new NotFoundException(
          `Notification ${id} not found or not failed`
        );
      }

      // 2️⃣ Update the notification status to queued
      await dbQuery(
        `UPDATE notifications 
       SET status=$1, attempts=0, updated_at=NOW() 
       WHERE id=$2`,
        ["queued", id]
      );

      // 3️⃣ Build the payload for the main queue
      const payload = {
        notif_id: notif.id,
        parcel_id: notif.parcel_id,
        channel: notif.channel,
        post_office_center: notif.post_office_center,
        recipient: {
          name: notif.recipient_name,
          role: notif.recipient_role,
          destination: decryptDestination(notif.recipient_destination),
        },
        template_vars:
          typeof notif.template_vars === "string"
            ? JSON.parse(notif.template_vars)
            : notif.template_vars,
        attachments: notif.attachments_meta || undefined,
        created_at: new Date().toISOString(),
      };

      // 4️⃣ Publish to the main delivery queue
      await publishDelivery(payload);

      // 5️⃣ Enqueue a requeue job for the cleanup worker
      try {
        await publishRequeue({ notif_id: notif.id, channel: notif.channel });
      } catch (err) {
        // Log but don't fail the main transaction
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.warn(
          `⚠️ Failed to enqueue DLQ cleanup for notif_id ${notif.id}: ${errMsg}`
        );
      }

      await dbQuery("COMMIT");

      return { message: "Requeued successfully" };
    } catch (err: unknown) {
      await dbQuery("ROLLBACK");
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`❌ markQueued failed for ${id}: ${errMsg}`);
      throw new InternalServerErrorException("Failed to requeue notification");
    }
  }

  // --- Mark notification as resolved
  async markResolved(id: string) {
    try {
      await dbQuery("BEGIN");

      const res = await dbQuery(
        "SELECT id, channel FROM notifications WHERE id=$1 FOR UPDATE",
        [id]
      );
      const notif = res.rows[0];

      if (!notif) {
        await dbQuery("ROLLBACK");
        throw new NotFoundException(`Notification ${id} not found`);
      }

      await dbQuery(
        "UPDATE notifications SET status=$1, updated_at=now() WHERE id=$2",
        ["resolved", id]
      );

      // ✅ Enqueue cleanup job safely
      await publishRequeue({ notif_id: id, channel: notif.channel });

      await dbQuery("COMMIT");

      return { message: "Resolved and DLQ cleanup job queued" };
    } catch (err: unknown) {
      await dbQuery("ROLLBACK");
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error(`❌ markResolved failed for ${id}: ${errMsg}`);
      throw new InternalServerErrorException(
        "Failed to mark notification as resolved"
      );
    }
  }
}
