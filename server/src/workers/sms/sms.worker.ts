// src/workers/sms-worker.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel, publishDeliveryDelayed } from "../../utils/rabbitmq";
import { logger } from "../../utils/logger";
import SendSMSTermii from "../../helpers/sendSMSTermii";
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
  [key: string]: any;
}

@Injectable()
export class SmsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly queueName = "notifications.sms";
  private readonly maxRetries = 3;
  private channel: ConfirmChannel | null = null;

  async onModuleInit() {
    logger.info("🚀 Starting SMS Worker...");
    const ch = await getChannel();
    if (!ch) {
      logger.error("❌ Failed to get RabbitMQ channel.");
      return;
    }

    this.channel = ch as unknown as ConfirmChannel;
    this.channel.prefetch(5);

    await this.channel.consume(this.queueName, this.handleMessage.bind(this), {
      noAck: false,
    });
    logger.info(`✅ SMS worker is consuming from queue: ${this.queueName}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🧹 RabbitMQ channel closed gracefully.");
  }

  private formatMessage(job: SMSJob): string {
    const { recipient, template_vars } = job;
    const role = recipient.role;
    const status = template_vars.status?.toLowerCase() || "N/A";
    const trackingNumber = template_vars.tracking_number || "N/A";
    const amount = template_vars.amount ?? 0;
    const customerName = recipient.name || "Customer";

    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);

    switch (true) {
      case role === "sender" && status === "queued":
        return `Hi ${customerName}, Thank you for your shipment. Order ${trackingNumber} estimated charges: ${formattedAmount}.`;
      case role === "receiver" && status === "queued":
        return `Hi ${customerName}, A shipment has been sent for you. Order Id: ${trackingNumber}.`;
      case (role === "sender" || role === "receiver") &&
        status === "dispatched":
        return `Hi ${customerName}, your shipment ${trackingNumber} is dispatched.`;
      case (role === "sender" || role === "receiver") && status === "arrived":
        return `Hi ${customerName}, your shipment ${trackingNumber} is ready for collection.`;
      case role === "sender" && status === "received":
        return `Hi ${customerName}, your shipment ${trackingNumber} has been received.`;
      case role === "receiver" && status === "received":
        return `Hi ${customerName}, you have received shipment ${trackingNumber}.`;
      default:
        return `Hi ${customerName}, your package ${trackingNumber} has a status update: ${status}.`;
    }
  }

  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg || !this.channel) return;

    let job: SMSJob;
    try {
      job = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error("❌ Failed to parse job:", err);
      this.channel.nack(msg, false, false); // send to DLQ
      return;
    }

    const attempts = job.attempts ?? 0;

    // Validate recipient
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

    // SMS sending window
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

    // Prepare SMS
    const body = this.formatMessage(job);
    let smsResponse: TermiiResponse | null = null;

    const nextAttempts = attempts + 1;

    try {
      smsResponse = await SendSMSTermii({
        to: job.recipient.destination,
        body,
      });

      // SMS sent successfully
      if (smsResponse?.success) {
        await pool.query(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["sent", nextAttempts, null, job.notif_id]
        );
        logger.info(JSON.stringify(smsResponse?.message));
        this.channel.ack(msg);
        return;
      } else {
        // SMS not sent successfully
        await pool.query(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["queue", nextAttempts, JSON.stringify(smsResponse), job.notif_id]
        );
        logger.info(JSON.stringify(smsResponse?.message));
      }
    } catch (err) {}

    // Retry logic
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
      this.channel.nack(msg, false, false); // DLQ
      return;
    }

    // Schedule retry
    job.attempts = nextAttempts;
    await pool.query(
      "UPDATE notifications SET attempts=$1, last_error=$2, updated_at=now() WHERE id=$3",
      [nextAttempts, JSON.stringify(smsResponse), job.notif_id]
    );

    const retryDelayMs = Math.pow(2, nextAttempts) * 60 * 60 * 6 * 1000; // exponential backoff in hours
    await publishDeliveryDelayed(job, retryDelayMs); // 2 * 60 * 60 * 6 * 1000
    this.channel.ack(msg);

    logger.warn(
      JSON.stringify({
        notif_id: job.notif_id,
        reason: "Retrying",
        attempts: nextAttempts,
      })
    );
  }
}
