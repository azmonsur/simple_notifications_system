// src/workers/whatsapp/whatsapp.worker.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel, publishDeliveryDelayed } from "../../utils/rabbitmq";
import { logger } from "../../utils/logger";
import SendWhatsAppCloud from "../../helpers/sendWhatsappCloud";
import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://notif:notifpass@localhost:5432/notifications",
});

interface Recipient {
  name?: string;
  destination: string;
}

interface TemplateVars {
  tracking_number?: string;
  status?: string;
  amount?: number;
  role?: "sender" | "receiver";
}

interface WhatsAppJob {
  notif_id: string;
  recipient: Recipient;
  template_vars: TemplateVars;
  channel?: string;
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
export class WhatsappWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly queueName = "notifications.whatsapp";
  private readonly maxRetries = 3;
  private channel: ConfirmChannel | null = null;

  async onModuleInit() {
    logger.info("🚀 Starting WhatsApp Worker...");
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
    logger.info(`✅ WhatsApp worker consuming from ${this.queueName}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🧹 WhatsApp channel closed gracefully.");
  }

  private formatPlainMessage(job: WhatsAppJob): string {
    const { recipient, template_vars } = job;
    const trackingNumber = template_vars.tracking_number || "N/A";
    const status = template_vars.status || "pending";
    const amount = template_vars.amount ?? 0;

    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);

    return `Hello ${
      recipient.name || "Customer"
    }, your package ${trackingNumber} is ${status}. Amount: ${formattedAmount}`;
  }

  private getTemplateName(job: WhatsAppJob): string {
    const { role, status } = job.template_vars;

    if (role === "sender" && status === "queued") return "sender_queued";
    if (role === "receiver" && status === "queued") return "receiver_queued";
    if ((role === "sender" || role === "receiver") && status === "dispatched")
      return "dispatched_update";
    if ((role === "sender" || role === "receiver") && status === "arrived")
      return "arrived_update";
    if (role === "sender" && status === "received") return "sender_received";
    if (role === "receiver" && status === "received")
      return "receiver_received";

    return "default_update";
  }

  private getTemplateParams(job: WhatsAppJob) {
    const { recipient, template_vars } = job;
    const amount = template_vars.amount ?? 0;
    return {
      customer_name: recipient.name || "Customer",
      tracking_number: template_vars.tracking_number || "N/A",
      status: template_vars.status || "N/A",
      amount: amount.toString(),
    };
  }

  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg || !this.channel) return;

    let job: WhatsAppJob;
    try {
      job = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error("❌ Failed to parse WhatsApp job:", err);
      this.channel.nack(msg, false, false); // DLQ
      return;
    }

    const attempts = job.attempts ?? 0;
    const nextAttempts = attempts + 1;

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

    // Prepare message
    const phone = job.recipient.destination;
    const useTemplate = process.env.WHATSAPP_USE_TEMPLATE === "true";

    const messageOptions: {
      body?: string;
      templateName?: string;
      templateParams?: Record<string, string>;
    } = useTemplate
      ? {
          templateName: this.getTemplateName(job),
          templateParams: this.getTemplateParams(job),
        }
      : { body: this.formatPlainMessage(job) };

    let response: any = null;

    try {
      response = await SendWhatsAppCloud({ to: phone, ...messageOptions });

      if (response?.success) {
        // WhatsApp Sent successfully
        await pool.query(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["sent", nextAttempts, null, job.notif_id]
        );
        logger.info(
          JSON.stringify({
            notif_id: job.notif_id,
            to: phone,
            status: "sent",
            response,
          })
        );
        this.channel.ack(msg);
        return;
      } else {
        // WhatsApp Not successful
        await pool.query(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["queue", nextAttempts, JSON.stringify(response), job.notif_id]
        );
        logger.warn(
          JSON.stringify({
            notif_id: job.notif_id,
            to: phone,
            reason: "Non-success response",
            response,
          })
        );
      }
    } catch (err) {}

    // Retry handling
    if (nextAttempts > this.maxRetries) {
      await pool.query(
        "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
        ["failed", nextAttempts, JSON.stringify(response), job.notif_id]
      );
      logger.error(
        JSON.stringify({
          notif_id: job.notif_id,
          reason: "Max retries reached",
          response,
        })
      );
      this.channel.nack(msg, false, false); // DLQ
      return;
    }

    // Schedule retry with exponential backoff (6-hour multiplier like SMS)
    job.attempts = nextAttempts;
    const retryDelayMs = Math.pow(2, nextAttempts) * 60 * 60 * 6 * 1000;

    await publishDeliveryDelayed(job, retryDelayMs);
    this.channel.ack(msg);

    logger.warn(
      JSON.stringify({
        notif_id: job.notif_id,
        reason: "Retrying WhatsApp message",
        attempts: nextAttempts,
        retryDelayMs,
      })
    );
  }
}
