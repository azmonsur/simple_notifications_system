// src/workers/sms/sms.worker.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel, publishDeliveryDelayed } from "../../utils/rabbitmq";
import { logger } from "../../utils/logger";
import SendSMSTermii from "../../helpers/sendSMSTermii";
import { Pool } from "pg";
import Bottleneck from "bottleneck";

// PostgreSQL connection pool
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://notif:notifpass@localhost:5432/notifications",
});

// --- Interfaces ---
interface Recipient {
  role?: "sender" | "receiver";
  name?: string;
  destination: string;
}

interface TemplateVars {
  status?: string;
  tracking_number?: string;
  amount?: number;
  post_office_center?: string;
}

interface SMSJob {
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

interface TermiiResponse {
  message_id?: string;
  status?: string;
  success?: boolean;
  message?: string;
  [key: string]: any;
}

// --- Worker Service ---
@Injectable()
export class SmsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly queueName = "notifications.sms";
  private readonly maxRetries = 3;
  private readonly maxConcurrentJobs = 5;
  private channel: ConfirmChannel | null = null;

  // Bottleneck rate limiter
  private readonly limiter = new Bottleneck({
    minTime: 200, // 5 requests/sec
    maxConcurrent: 2,
  });

  async onModuleInit() {
    logger.info("🚀 Starting SMS Worker...");
    const ch = await getChannel();

    if (!ch) {
      logger.error("❌ Failed to get RabbitMQ channel.");
      return;
    }

    this.channel = ch as unknown as ConfirmChannel;
    this.channel.prefetch(this.maxConcurrentJobs);

    await this.channel.consume(
      this.queueName,
      (msg) => {
        if (!msg) return;
        this.limiter
          .schedule(() => this.handleMessage(msg))
          .catch((err) => {
            logger.error("❌ Unhandled SMS job error:", err);
            this.channel?.nack(msg, false, true);
          });
      },
      { noAck: false }
    );

    logger.info(`✅ SMS worker is consuming from queue: ${this.queueName}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🧹 RabbitMQ channel closed gracefully.");
  }

  // --- Message Formatter ---
  private formatMessage(job: SMSJob): string {
    const { recipient, template_vars } = job;
    const role = recipient.role;
    const status = (template_vars.status || "pending").toLowerCase();
    const trackingNumber = template_vars.tracking_number || "N/A";
    const amount = template_vars.amount ?? 0;
    const customerName = recipient.name || "Customer";
    const postOfficeCenter =
      template_vars.post_office_center || "your nearest post office";

    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);

    let textBody = "";

    switch (true) {
      case role === "sender" && status === "pending":
        textBody = `Hi ${customerName}, Thank you for your shipment. Order (${trackingNumber}) estimated charges: ${formattedAmount}.`;
        break;

      case role === "receiver" && status === "pending":
        textBody = `Hi ${customerName}, A shipment with tracking ID (${trackingNumber}) has been booked for you.`;
        break;

      case role === "sender" && status === "dispatched":
        textBody = `Hi ${customerName}, Your shipment (${trackingNumber}) has been dispatched.`;
        break;

      case role === "receiver" && status === "dispatched":
        textBody = `Hi ${customerName}, Your shipment (${trackingNumber}) has been dispatched to ${postOfficeCenter}.`;
        break;

      case (role === "receiver" || role === "sender") && status === "arrived":
        textBody = `Hi ${customerName}, Your shipment (${trackingNumber}) has arrived at ${postOfficeCenter} and is ready for collection.`;
        break;

      case role === "sender" && status === "received":
        textBody = `Hi ${customerName}, Your shipment (${trackingNumber}) has been collected.`;
        break;

      case role === "receiver" && status === "received":
        textBody = `Hi ${customerName}, You have successfully collected your shipment (${trackingNumber}) at ${postOfficeCenter}.`;
        break;

      default:
        textBody = `Hi ${customerName}, Your package ${trackingNumber} has a status update: ${status}.`;
        break;
    }

    return textBody;
  }

  // --- Message Handler ---
  private async handleMessage(msg: ConsumeMessage) {
    if (!this.channel) return;

    let job: SMSJob;
    try {
      job = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error("❌ Failed to parse job:", err);
      this.channel.nack(msg, false, false);
      return;
    }

    const attempts = job.attempts ?? 0;

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

    // Time-based restriction (8 AM – 8 PM)
    const now = new Date();
    const hour = now.getHours();
    const sendWindowStart = parseInt(process.env.SMS_WINDOW_START || "8");
    const sendWindowEnd = parseInt(process.env.SMS_WINDOW_END || "20");

    if (hour < sendWindowStart || hour >= sendWindowEnd) {
      const delayHours =
        hour >= sendWindowEnd
          ? 24 - hour + sendWindowStart
          : sendWindowStart - hour;
      const delayMs = delayHours * 60 * 60 * 1000;

      logger.warn(
        JSON.stringify({
          notif_id: job.notif_id,
          reason: "Outside send window",
          delayHours,
        })
      );

      await publishDeliveryDelayed(job, delayMs);
      this.channel.ack(msg);
      return;
    }

    const body = this.formatMessage(job);
    let smsResponse: TermiiResponse | null = null;
    const nextAttempts = attempts + 1;

    try {
      logger.info("");
      smsResponse = await SendSMSTermii({
        to: job.recipient.destination,
        body,
      });

      if (smsResponse?.success) {
        await pool.query(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["sent", nextAttempts, null, job.notif_id]
        );
        logger.info(JSON.stringify(smsResponse?.message));
        this.channel.ack(msg);
      } else {
        await pool.query(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["queued", nextAttempts, JSON.stringify(smsResponse), job.notif_id]
        );
        logger.warn(JSON.stringify(smsResponse?.message));
        await this.handleRetry(job, nextAttempts, smsResponse, msg);
      }
    } catch (err) {
      logger.error(`❌ SMS sending failed for ${job.notif_id}:`, err);
      await this.handleRetry(job, nextAttempts, smsResponse, msg);
    }
  }

  // --- Retry Logic ---
  private async handleRetry(
    job: SMSJob,
    nextAttempts: number,
    smsResponse: TermiiResponse | null,
    msg: ConsumeMessage
  ) {
    if (!this.channel) return;

    if (nextAttempts > this.maxRetries) {
      await pool.query(
        "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
        ["failed", nextAttempts, JSON.stringify(smsResponse), job.notif_id]
      );

      logger.error(
        JSON.stringify({
          notif_id: job.notif_id,
          reason: "Max retries reached",
          response: smsResponse,
        })
      );

      this.channel.nack(msg, false, false);
      return;
    }

    job.attempts = nextAttempts;
    await pool.query(
      "UPDATE notifications SET attempts=$1, last_error=$2, updated_at=now() WHERE id=$3",
      [nextAttempts, JSON.stringify(smsResponse), job.notif_id]
    );

    // Progressive backoff delay schedule
    const retrySchedule = [
      30 * 60 * 1000, // 30 mins
      2 * 60 * 60 * 1000, // 2 hours
      6 * 60 * 60 * 1000, // 6 hours
    ];
    const retryDelayMs =
      retrySchedule[Math.min(nextAttempts - 1, retrySchedule.length - 1)];

    await publishDeliveryDelayed(job, retryDelayMs);
    this.channel.ack(msg);

    logger.warn(
      JSON.stringify({
        notif_id: job.notif_id,
        reason: "Retrying",
        attempts: nextAttempts,
        retryDelayMinutes: retryDelayMs / (60 * 1000),
      })
    );
  }
}
