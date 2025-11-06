// src/workers/email-worker.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel, publishDeliveryDelayed } from "../../utils/rabbitmq";
import { logger } from "../../utils/logger";
import SendEmailPostmark from "../../helpers/sendEmailPostmark";
import SendEmailMailerSend from "../../helpers/sendEmailMailersend";
import Bottleneck from "bottleneck";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://notif:notifpass@localhost:5432/notifications",
});

interface Recipient {
  role?: "sender" | "receiver";
  name?: string;
  destination: string;
}

interface TemplateVars {
  status?: string;
  tracking_number?: string;
  amount?: number;
}

interface EmailJob {
  notif_id: string;
  recipient: Recipient;
  template_vars: TemplateVars;
  attempts?: number;
}

type ConsumeMessage = {
  content: Buffer;
  fields: any;
  properties: any;
};

type ConfirmChannel = {
  consume: (
    queue: string,
    onMessage: (msg: ConsumeMessage | null) => void,
    options?: any
  ) => Promise<any>;
  ack: (msg: ConsumeMessage) => void;
  nack: (msg: ConsumeMessage, allUpTo?: boolean, requeue?: boolean) => void;
  prefetch: (count: number) => void;
  close?: () => Promise<void>;
};

// interface TermiiResponse {
//   message_id?: string;
//   status?: string;
//   [key: string]: any;
// }

@Injectable()
export class EmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly queueName = "notifications.email";
  private readonly maxRetries = 3;
  private channel: ConfirmChannel | null = null;

  private readonly limiter = new Bottleneck({
    minTime: 50, // 50ms between requests
    maxConcurrent: 5,
  });

  async onModuleInit() {
    logger.info("🚀 Starting Email Worker...");

    const ch = await getChannel();
    if (!ch) {
      logger.error("❌ Failed to get RabbitMQ channel.");
      return;
    }

    this.channel = ch as unknown as ConfirmChannel;
    this.channel.prefetch(20);

    await this.channel.consume(this.queueName, this.handleMessage.bind(this), {
      noAck: false,
    });
    logger.info(`✅ Email worker consuming from ${this.queueName}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🧹 RabbitMQ channel closed gracefully.");
  }

  private formatEmail(job: EmailJob) {
    const { recipient, template_vars } = job;
    const role = recipient.role;
    const status = template_vars.status?.toLowerCase() || "pending";
    const trackingNumber = template_vars.tracking_number || "N/A";
    const amount = template_vars.amount ?? 0;
    const customerName = recipient.name || "Customer";

    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);

    let textBody = "";
    let htmlBody = "";

    switch (true) {
      case role === "sender" && status === "queued":
        textBody = `Hi ${customerName}, Thank you for your shipment. Order ${trackingNumber} estimated charges: ${formattedAmount}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Thank you for your shipment. Order <strong>${trackingNumber}</strong> estimated charges: <strong>${formattedAmount}</strong>.</p>`;
        break;

      case role === "receiver" && status === "queued":
        textBody = `Hi ${customerName}, A shipment has been sent for you. Order Id: ${trackingNumber}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>A shipment has been sent for you. Order Id: <strong>${trackingNumber}</strong>.</p>`;
        break;

      case (role === "sender" || role === "receiver") &&
        status === "dispatched":
        textBody = `Hi ${customerName}, your shipment ${trackingNumber} is dispatched.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment <strong>${trackingNumber}</strong> is dispatched.</p>`;
        break;

      case (role === "sender" || role === "receiver") && status === "arrived":
        textBody = `Hi ${customerName}, your shipment ${trackingNumber} is ready for collection.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment <strong>${trackingNumber}</strong> is ready for collection.</p>`;
        break;

      case role === "sender" && status === "received":
        textBody = `Hi ${customerName}, your shipment ${trackingNumber} has been received.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment <strong>${trackingNumber}</strong> has been received.</p>`;
        break;

      case role === "receiver" && status === "received":
        textBody = `Hi ${customerName}, you have received shipment ${trackingNumber}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>You have received shipment <strong>${trackingNumber}</strong>.</p>`;
        break;

      default:
        textBody = `Hi ${customerName}, your package ${trackingNumber} has a status update: ${status}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your package <strong>${trackingNumber}</strong> has a status update: <strong>${status}</strong>.</p>`;
        break;
    }

    const subject = `Parcel Update: ${trackingNumber} - ${status}`;
    return { subject, textBody, htmlBody };
  }

  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg || !this.channel) return;

    let job: EmailJob;
    try {
      job = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error("❌ Failed to parse email job:", err);
      this.channel.ack(msg);
      return;
    }

    if (!job.recipient?.destination) {
      logger.warn(
        JSON.stringify({ notif_id: job.notif_id, reason: "Missing recipient" })
      );
      await pool.query(
        "UPDATE notifications SET status=$1, last_error=$2, updated_at=now() WHERE id=$3",
        ["failed", "Missing recipient", job.notif_id]
      );
      this.channel.ack(msg);
      return;
    }

    let sent = false;
    let attemptCount = job.attempts || 0;
    const { subject, textBody, htmlBody } = this.formatEmail(job);

    await this.limiter.schedule(async () => {
      while (!sent && attemptCount < this.maxRetries) {
        attemptCount++;
        try {
          const response = await SendEmailMailerSend({
            to: job.recipient.destination,
            subject,
            body: textBody,
            htmlBody,
          });

          // SMS sent successfully
          if (response?.success) {
            await pool.query(
              "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
              ["sent", attemptCount, null, job.notif_id]
            );
            logger.info(
              JSON.stringify({
                notif_id: job.notif_id,
                to: job.recipient.destination,
                attempt: attemptCount,
                status: "sent",
                response,
              })
            );

            sent = true;
            this.channel!.ack(msg);
            return;
          } else {
            // SMS not sent successfully

            const delayMs = Math.pow(2, attemptCount) * 60 * 60 * 6 * 1000; // exponential backoff in hours; // exponential backoff

            if (attemptCount >= this.maxRetries) {
              logger.error(
                JSON.stringify({
                  notif_id: job.notif_id,
                  to: job.recipient.destination,
                  reason: "Max retries reached",
                  error: response,
                })
              );

              await pool.query(
                "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
                [
                  "failed",
                  attemptCount,
                  JSON.stringify(response?.error),
                  job.notif_id,
                ]
              );

              this.channel!.nack(msg, false, false);
              return;
            }

            // Retry
            await pool.query(
              "UPDATE notifications SET attempts=$1, last_error=$2, updated_at=now() WHERE id=$3",
              [attemptCount, JSON.stringify(response?.error), job.notif_id]
            );

            await publishDeliveryDelayed(job, delayMs);
            this.channel!.ack(msg);

            logger.warn(
              JSON.stringify({
                notif_id: job.notif_id,
                to: job.recipient.destination,
                attempt: attemptCount,
                reason: "Retrying",
                delayMs,
                error: response,
              })
            );

            await new Promise((r) => setTimeout(r, delayMs));
          }
        } catch (err) {
          logger.info("Something whent wrong");
        }
      }
    });
  }
}
