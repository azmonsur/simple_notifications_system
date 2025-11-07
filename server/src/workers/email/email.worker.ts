import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel, publishDeliveryDelayed } from "../../utils/rabbitmq";
import { logger } from "../../utils/logger";
import SendEmailPostmark from "../../helpers/sendEmailPostmark";
import SendEmailMailerSend from "../../helpers/sendEmailMailersend";
import SendEmailSendGrid from "../../helpers/sendEmailSendgrid";
import { toTitleCase } from "../../helpers/convertToTitleCase";
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
  post_office_center: string;
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

@Injectable()
export class EmailWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly queueName = "notifications.email";
  private readonly maxRetries = 3;
  private channel: ConfirmChannel | null = null;

  private readonly limiter = new Bottleneck({
    minTime: 100,
    maxConcurrent: 3,
  });

  async onModuleInit() {
    logger.info("🚀 Starting Email Worker...");

    const ch = await getChannel();
    if (!ch) {
      logger.error("❌ Failed to get RabbitMQ channel.");
      return;
    }

    this.channel = ch as unknown as ConfirmChannel;
    this.channel.prefetch(5);

    await this.channel.consume(
      this.queueName,
      (msg: ConsumeMessage | null) => {
        if (!msg) return;
        this.limiter
          .schedule(() => this.processMessage(msg))
          .catch((err) => {
            logger.error("❌ Unhandled error:", err);
            this.safeNack(msg, false, true);
          });
      },
      { noAck: false }
    );

    logger.info(`✅ Email worker consuming from ${this.queueName}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    await pool.end().catch(() => {});
    logger.info("🧹 Email worker stopped.");
  }

  private formatEmail(job: EmailJob) {
    const { recipient, template_vars, post_office_center } = job;
    const role = recipient.role;
    const status = (template_vars.status || "pending").toLowerCase();
    const trackingNumber = template_vars.tracking_number || "N/A";
    const amount = template_vars.amount ?? 0;
    const customerName = recipient.name || "Customer";

    const postOfficeCenter = post_office_center ? post_office_center : "";

    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);

    const subject = `Parcel Update: ${trackingNumber.toUpperCase()} - ${toTitleCase(
      status
    )}`;

    let textBody = "";
    let htmlBody = "";

    switch (true) {
      case role === "sender" && status === "pending":
        textBody = `Hi ${customerName}, Thank you for your shipment at ${postOfficeCenter}. Order ${trackingNumber} estimated charges: ${formattedAmount}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Thank you for your shipment at ${postOfficeCenter}. Order <strong>${trackingNumber}</strong> estimated charges: <strong>${formattedAmount}</strong>.</p>`;
        break;
      case role === "receiver" && status === "pending":
        textBody = `Hi ${customerName}, A shipment with tracking ID (${trackingNumber}) has been taken for you at ${postOfficeCenter}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>A shipment with tracking ID (<strong>${trackingNumber}</strong>) has been taken for you.</p>`;
        break;
      case role === "sender" && status === "dispatched":
        textBody = `Hi ${customerName}, Your shipment with tracking ID (${trackingNumber}) has been dispatched to ${postOfficeCenter}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment with tracking ID (<strong>${trackingNumber}</strong>) has been dispatched.</p>`;
        break;
      case role === "receiver" && status === "dispatched":
        textBody = `Hi ${customerName}, Your shipment with tracking ID (${trackingNumber}) has been dispatched to ${postOfficeCenter}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment with tracking ID (<strong>${trackingNumber}</strong>) has been dispatched to ${postOfficeCenter}.</p>`;
        break;
      case (role === "receiver" || role === "sender") && status === "arrived":
        textBody = `Hi ${customerName}, Your shipment with tracking ID (${trackingNumber}) is ready for collection at ${postOfficeCenter}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment with tracking ID (<strong>${trackingNumber}</strong>) is ready for collection at ${postOfficeCenter}.</p>`;
        break;
      case role === "sender" && status === "received":
        textBody = `Hi ${customerName}, Your shipment with tracking ID (${trackingNumber}) has been collected.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment with tracking ID (<strong>${trackingNumber}</strong>) has been collected.</p>`;
        break;
      case role === "receiver" && status === "received":
        textBody = `Hi ${customerName}, Your shipment with tracking ID (${trackingNumber}) has been collected by you.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment with tracking ID (<strong>${trackingNumber}</strong>) has been collected by you.</p>`;
        break;
      default:
        textBody = `Hi ${customerName}, your package ${trackingNumber} has a status update: ${status}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your package <strong>${trackingNumber}</strong> has a status update: <strong>${status}</strong>.</p>`;
        break;
    }

    return { subject, textBody, htmlBody };
  }

  private async processMessage(msg: ConsumeMessage): Promise<void> {
    let job: EmailJob;
    try {
      job = JSON.parse(msg.content.toString()) as EmailJob;
    } catch (err) {
      logger.error("❌ Invalid email payload:", err);
      this.safeAck(msg);
      return;
    }

    const destination = job.recipient?.destination;
    if (!destination) {
      await pool.query(
        "UPDATE notifications SET status=$1, last_error=$2, updated_at=now() WHERE id=$3",
        ["failed", "Missing recipient", job.notif_id]
      );
      this.safeAck(msg);
      return;
    }

    const { subject, textBody, htmlBody } = this.formatEmail(job);
    const attempts = job.attempts ?? 0;

    try {
      const provider = SendEmailSendGrid;

      const result = await provider({
        to: destination,
        subject,
        body: textBody,
        htmlBody,
      });

      if (result?.success) {
        await pool.query(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["sent", attempts + 1, null, job.notif_id]
        );
        this.safeAck(msg);
        logger.info(`✅ Email sent: ${destination}`);
      } else {
        await this.handleRetry(job, attempts + 1, result, msg);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      logger.error(`❌ Email send failed: ${errorMsg}`);
      await this.handleRetry(job, attempts + 1, errorMsg, msg);
    }
  }

  private async handleRetry(
    job: EmailJob,
    nextAttempts: number,
    error: any,
    msg: ConsumeMessage
  ): Promise<void> {
    if (nextAttempts > this.maxRetries) {
      await pool.query(
        "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
        ["failed", nextAttempts, JSON.stringify(error), job.notif_id]
      );
      this.safeNack(msg, false, false);
      logger.error(
        `❌ Max retries reached for ${job.notif_id}. Sent to DLQ or discarded.`
      );
      return;
    }

    job.attempts = nextAttempts;
    await pool.query(
      "UPDATE notifications SET attempts=$1, last_error=$2, updated_at=now() WHERE id=$3",
      [nextAttempts, JSON.stringify(error), job.notif_id]
    );

    const retrySchedule = [
      30 * 60 * 1000, // 30 mins
      2 * 60 * 60 * 1000, // 2 hrs
      6 * 60 * 60 * 1000, // 6 hrs
    ];
    const retryDelayMs =
      retrySchedule[Math.min(nextAttempts - 1, retrySchedule.length - 1)];

    await publishDeliveryDelayed(job, retryDelayMs);
    this.safeAck(msg);
    logger.warn(
      `⚠️ Retry scheduled for ${job.notif_id} after ${
        retryDelayMs / 60000
      } minutes`
    );
  }

  private safeAck(msg: ConsumeMessage): void {
    try {
      this.channel?.ack(msg);
    } catch (err) {
      logger.error("safeAck failed:", err);
    }
  }

  private safeNack(
    msg: ConsumeMessage,
    allUpTo = false,
    requeue = false
  ): void {
    try {
      this.channel?.nack(msg, allUpTo, requeue);
    } catch (err) {
      logger.error("safeNack failed:", err);
    }
  }
}
