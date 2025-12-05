// src/workers/sms/sms.worker.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel, publishDeliveryToBucket } from "../../../utils/rabbitmq";
import { query as dbQuery } from "../../../utils/db";
import SendSMSTermii from "../../../helpers/sendSMSTermii";
import Bottleneck from "bottleneck";
import { logger } from "../../../utils/logger";
import { decryptDestination } from "../../../modules/notifications/utils/crypto";

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
  channel?: string;
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

// --- SMS Worker Service ---
@Injectable()
export class SmsWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly queueName = "notifications.sms";
  private readonly maxRetries = 3;
  private readonly maxConcurrentJobs = 5;
  private channel: ConfirmChannel | null = null;

  // Rate limiter
  private readonly limiter = new Bottleneck({
    minTime: 200,
    maxConcurrent: 2,
  });

  async onModuleInit() {
    logger.info("🚀 Starting SMS Worker...");
    this.channel = (await getChannel()) as unknown as ConfirmChannel;

    if (!this.channel) {
      logger.error("❌ Failed to get RabbitMQ channel.");
      return;
    }

    this.channel.prefetch(this.maxConcurrentJobs);
    await this.channel.consume(
      this.queueName,
      (msg) => {
        if (!msg) return;
        this.limiter
          .schedule(() => this.processMessage(msg))
          .catch((err) => {
            logger.error("❌ Unhandled SMS job error:", err);
            this.safeNack(msg);
          });
      },
      { noAck: false }
    );

    logger.info(`✅ SMS worker consuming queue: ${this.queueName}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🧹 RabbitMQ channel closed gracefully.");
  }

  // --- Core message processor ---
  private async processMessage(msg: ConsumeMessage) {
    if (!this.channel) return;

    let job: SMSJob;
    try {
      job = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error("❌ Invalid JSON message:", err);
      return this.safeAck(msg);
    }

    try {
      this.validateJob(job);

      // Time-based restriction
      if (!this.isWithinSendWindow()) {
        const delayMs = this.getNextSendWindowDelay();
        logger.warn(
          `⏰ Job ${job.notif_id} outside send window, delaying for ${
            delayMs / 3600000
          } hours`
        );
        job.attempts = (job.attempts ?? 0) + 1;
        await publishDeliveryToBucket(job.channel || "sms", job, job.attempts);
        return this.safeAck(msg);
      }

      const smsBody = this.formatMessage(job);
      await this.sendSMS(job, smsBody, msg);
    } catch (err: any) {
      logger.error(
        `❌ SMS failed (notif ${job?.notif_id || "unknown"}): ${err.message}`
      );
      await this.handleRetry(job, msg);
    }
  }

  // --- Validate job structure ---
  private validateJob(job: SMSJob) {
    if (!job.notif_id) throw new Error("Missing notif_id");
    if (!job.recipient?.destination)
      throw new Error("Missing recipient destination");
  }

  // --- Format SMS message ---
  private formatMessage(job: SMSJob): string {
    const { recipient, template_vars } = job;
    const role = recipient.role;
    const status = (template_vars.status || "pending").toLowerCase();
    const trackingNumber = template_vars.tracking_number || "N/A";
    const amount = template_vars.amount ?? 0;
    const customerName = recipient.name || "Customer";
    const postOffice =
      template_vars.post_office_center || "your nearest post office";

    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);

    switch (true) {
      case role === "sender" && status === "pending":
        return `Hi ${customerName}, Thank you for your shipment. Order (${trackingNumber}) estimated charges: ${formattedAmount}.`;
      case role === "receiver" && status === "pending":
        return `Hi ${customerName}, A shipment with tracking ID (${trackingNumber}) has been booked for you.`;
      case role === "sender" && status === "dispatched":
        return `Hi ${customerName}, Your shipment (${trackingNumber}) has been dispatched.`;
      case role === "receiver" && status === "dispatched":
        return `Hi ${customerName}, Your shipment (${trackingNumber}) has been dispatched to ${postOffice}.`;
      case (role === "receiver" || role === "sender") && status === "arrived":
        return `Hi ${customerName}, Your shipment (${trackingNumber}) has arrived at ${postOffice} and is ready for collection.`;
      case role === "sender" && status === "received":
        return `Hi ${customerName}, Your shipment (${trackingNumber}) has been collected.`;
      case role === "receiver" && status === "received":
        return `Hi ${customerName}, You have successfully collected your shipment (${trackingNumber}) at ${postOffice}.`;
      default:
        return `Hi ${customerName}, Your package ${trackingNumber} has a status update: ${status}.`;
    }
  }

  // --- Send SMS and update DB ---
  private async sendSMS(job: SMSJob, body: string, msg: ConsumeMessage) {
    const attempts = (job.attempts ?? 0) + 1;

    try {
      const response = await SendSMSTermii({
        to: decryptDestination(job.recipient.destination),
        body,
      });

      if (response?.success) {
        await dbQuery(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, provider_message_id=$4, updated_at=now() WHERE id=$5",
          ["sent", attempts, null, response.data.message_id, job.notif_id]
        );
        logger.info(`✅ SMS sent → notif ${job.notif_id}`);
        return this.safeAck(msg);
      }

      await this.handleRetry(job, msg, response, attempts);
    } catch (err) {
      logger.error(`❌ SMS send error for ${job.notif_id}:`, err);
      await this.handleRetry(job, msg, null, attempts);
    }
  }

  // --- Retry logic (bucket-based) ---
  private async handleRetry(
    job: SMSJob,
    msg: ConsumeMessage,
    response: TermiiResponse | null = null,
    attempts?: number
  ) {
    if (!this.channel) return;
    const nextAttempts = attempts ?? (job.attempts ?? 0) + 1;

    if (nextAttempts > this.maxRetries) {
      await dbQuery(
        "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
        ["failed", nextAttempts, "Max retries reached", job.notif_id]
      );
      logger.error(
        `❌ notif ${job.notif_id} permanently failed → max retries reached`
      );
      return this.safeNack(msg, false, false);
    }

    job.attempts = nextAttempts;
    await dbQuery(
      "UPDATE notifications SET attempts=$1, last_error=$2, updated_at=now() WHERE id=$3",
      [nextAttempts, JSON.stringify(response), job.notif_id]
    );

    await publishDeliveryToBucket(job.channel || "sms", job, nextAttempts);

    logger.warn(
      `⚠️ notif ${job.notif_id} scheduled for retry via bucket system (attempt ${nextAttempts})`
    );
    this.safeAck(msg);
  }

  // --- Helpers: Ack/Nack ---
  private safeAck(msg: ConsumeMessage) {
    try {
      this.channel?.ack(msg);
    } catch (err) {
      logger.error("Ack failed:", err);
    }
  }

  private safeNack(
    msg: ConsumeMessage,
    allUpTo: boolean = false,
    requeue: boolean = true
  ) {
    try {
      this.channel?.nack(msg, allUpTo, requeue);
    } catch (err) {
      logger.error("Nack failed:", err);
    }
  }

  // --- Helpers: Send window ---
  private isWithinSendWindow(): boolean {
    const nowHour = new Date().getHours();
    const start = parseInt(process.env.SMS_WINDOW_START || "8");
    const end = parseInt(process.env.SMS_WINDOW_END || "20");
    return nowHour >= start && nowHour < end;
  }

  private getNextSendWindowDelay(): number {
    const nowHour = new Date().getHours();
    const start = parseInt(process.env.SMS_WINDOW_START || "8");
    const end = parseInt(process.env.SMS_WINDOW_END || "20");
    const delayHours = nowHour >= end ? 24 - nowHour + start : start - nowHour;
    return delayHours * 60 * 60 * 1000;
  }
}
