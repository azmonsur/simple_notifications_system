import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel, publishDeliveryToBucket } from "../../../utils/rabbitmq";
import { logger } from "../../../utils/logger";
import SendEmailSendGrid from "../../../helpers/sendEmailSendgrid";
import { toTitleCase } from "../../../helpers/convertToTitleCase";
import Bottleneck from "bottleneck";
import { query as dbQuery } from "../../../utils/db";
import { generateReceiptPDF } from "../../../helpers/generateReceiptPDF";

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
        textBody = `Hi ${customerName}, Thank you for your shipment at ${postOfficeCenter}. Order (${trackingNumber}) estimated charges: ${formattedAmount}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Thank you for your shipment at ${postOfficeCenter}. Order (<strong>${trackingNumber}</strong>) estimated charges: <strong>${formattedAmount}</strong>.</p>`;
        break;
      case role === "receiver" && status === "pending":
        textBody = `Hi ${customerName}, A shipment with tracking ID (${trackingNumber}) has been booked for you.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>A shipment with tracking ID (<strong>${trackingNumber}</strong>) has been booked for you.</p>`;
        break;
      case role === "sender" && status === "dispatched":
        textBody = `Hi ${customerName}, Your shipment with tracking ID (${trackingNumber}) has been dispatched.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment with tracking ID (<strong>${trackingNumber}</strong>) has been dispatched.</p>`;
        break;
      case role === "receiver" && status === "dispatched":
        textBody = `Hi ${customerName}, Your shipment with tracking ID (${trackingNumber}) has been dispatched to ${postOfficeCenter}.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment with tracking ID (<strong>${trackingNumber}</strong>) has been dispatched to ${postOfficeCenter}.</p>`;
        break;
      case (role === "receiver" || role === "sender") && status === "arrived":
        textBody = `Hi ${customerName}, Your shipment with tracking ID (${trackingNumber}) has arrived at ${postOfficeCenter} and is ready for collection.`;
        htmlBody = `<p>Hi <strong>${customerName}</strong>,</p><p>Your shipment with tracking ID (<strong>${trackingNumber}</strong>) has arrived at ${postOfficeCenter} and is ready for collection.</p>`;
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
      await dbQuery(
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

      let attachments: any[] | undefined = undefined;

      const { role } = job.recipient;
      const status = job.template_vars.status?.toLowerCase();

      if (role === "sender" && status === "pending") {
        const pdfBuffer = await generateReceiptPDF({
          transaction_id: job.template_vars.tracking_number as string,
          date: new Date().toISOString(),
          center: job.post_office_center as string,
          source: job.post_office_center,
          sender_name: job.recipient.name as string,
          sender_email: job.recipient.destination,
          service_type: "Parcel Shipment",
          amount_paid: job.template_vars.amount || 0,
          payment_method: "Cash",
        });

        attachments = [
          {
            filename: `NIPOST_Receipt_${job.template_vars.tracking_number}.pdf`,
            content: pdfBuffer,
            type: "application/pdf",
          },
        ];
      }

      const result = await provider({
        to: destination,
        subject,
        body: textBody,
        htmlBody,
        attachments,
      });

      if (result?.success) {
        await dbQuery(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, provider_message_id=$4, updated_at=now() WHERE id=$5",
          [
            "sent",
            attempts + 1,
            null,
            result.data.headers["x-message-id"],
            job.notif_id,
          ]
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
      await dbQuery(
        "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
        ["failed", nextAttempts, "Max retries reached", job.notif_id]
      );
      this.safeNack(msg, false, false);
      logger.error(
        `❌ Max retries reached for ${job.notif_id}. Sent to DLQ or discarded.`
      );
      return;
    }

    job.attempts = nextAttempts;
    await dbQuery(
      "UPDATE notifications SET attempts=$1, last_error=$2, updated_at=now() WHERE id=$3",
      [nextAttempts, JSON.stringify(error), job.notif_id]
    );

    // ✅ Publish to RabbitMQ bucket instead of fixed delay
    await publishDeliveryToBucket(job.channel || "email", job, nextAttempts);
    this.safeAck(msg);
    logger.warn(
      `⚠️ Retry scheduled for ${job.notif_id} via bucket system (attempt ${nextAttempts})`
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
