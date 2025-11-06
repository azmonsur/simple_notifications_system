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
  // any other fields you publish
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

  // Production-grade limiter (adjust concurrency/minTime as required)
  private readonly limiter = new Bottleneck({
    minTime: 50, // 20 req/sec approx
    maxConcurrent: 5,
  });

  async onModuleInit() {
    logger.info("🚀 Starting Email Worker (production mode)...");

    const ch = await getChannel();
    if (!ch) {
      logger.error("❌ Failed to get RabbitMQ channel.");
      return;
    }

    this.channel = ch as unknown as ConfirmChannel;

    // Prefetch should be slightly higher than concurrency to keep pipeline full
    this.channel.prefetch(10);

    // Consume messages and hand off to limiter which calls processMessage
    await this.channel.consume(
      this.queueName,
      (msg) => {
        if (!msg) return;
        // schedule processing - returns a promise; handle rejections to avoid unhandled rejections
        this.limiter
          .schedule(() => this.processMessage(msg))
          .catch((err) => {
            // If processMessage throws unexpectedly make sure we don't leave the message unacked.
            logger.error("❌ Unhandled error in processMessage", err);
            this.safeNack(msg, false, true);
          });
      },
      { noAck: false }
    );

    logger.info(`✅ Email worker consuming from ${this.queueName}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) {
      try {
        await this.channel.close();
      } catch (err) {
        logger.warn("⚠️ Error closing RabbitMQ channel", err);
      }
    }
    logger.info("🧹 Email worker stopped and channel closed.");
    await pool.end().catch(() => {});
  }

  // format email content
  private formatEmail(job: EmailJob) {
    const { recipient, template_vars } = job;
    const role = recipient.role;
    const status = (template_vars.status || "pending").toLowerCase();
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

  // safe ack/nack helpers
  private safeAck(msg: ConsumeMessage) {
    try {
      this.channel?.ack(msg);
    } catch (err) {
      logger.error("❌ safeAck failed", err);
    }
  }

  private safeNack(msg: ConsumeMessage, allUpTo = false, requeue = false) {
    try {
      this.channel?.nack(msg, allUpTo, requeue);
    } catch (err) {
      logger.error("❌ safeNack failed", err);
    }
  }

  // Wrap provider call with timeout to avoid hanging indefinitely
  private async sendWithTimeout(opts: {
    to: string;
    subject: string;
    body: string;
    htmlBody?: string;
    timeoutMs?: number;
  }) {
    const { to, subject, body, htmlBody, timeoutMs = 30000 } = opts;

    // You can choose provider selection logic here. Example: prefer MailerSend, fallback Postmark
    const call = async () => {
      try {
        // pick provider based on env or logic
        if (process.env.EMAIL_PROVIDER === "postmark") {
          return await SendEmailPostmark({
            to,
            subject,
            body,
            htmlBody,
          });
        } else {
          return await SendEmailMailerSend({
            to,
            subject,
            body,
            htmlBody,
          });
        }
      } catch (err) {
        // provider helpers return structured results, but keep catch in case they throw
        throw err;
      }
    };

    return await Promise.race([
      call(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Email provider timeout")), timeoutMs)
      ),
    ]);
  }

  // Core processing for each message
  private async processMessage(msg: ConsumeMessage) {
    if (!msg) return;

    let job: EmailJob;
    try {
      job = JSON.parse(msg.content.toString()) as EmailJob;
    } catch (err) {
      logger.error("❌ Failed to parse email job:", err);
      // bad payload — mark DB and ack to drop
      try {
        const notifId = (() => {
          try {
            const parsed = JSON.parse(msg.content.toString());
            return parsed?.notif_id;
          } catch {
            return null;
          }
        })();
        if (notifId) {
          await pool.query(
            "UPDATE notifications SET status=$1, last_error=$2, updated_at=now() WHERE id=$3",
            ["failed", "Invalid payload", notifId]
          );
        }
      } catch (e) {
        logger.warn("⚠️ Could not update DB for invalid payload", e);
      }
      this.safeAck(msg);
      return;
    }

    const destination = job.recipient?.destination;
    if (!destination) {
      logger.warn(
        JSON.stringify({ notif_id: job.notif_id, reason: "Missing recipient" })
      );
      await pool.query(
        "UPDATE notifications SET status=$1, last_error=$2, updated_at=now() WHERE id=$3",
        ["failed", "Missing recipient", job.notif_id]
      );
      this.safeAck(msg);
      return;
    }

    // prepare
    let attemptCount = job.attempts ?? 0;

    const { subject, textBody, htmlBody } = this.formatEmail(job);

    try {
      const result = (await this.sendWithTimeout({
        to: destination,
        subject,
        body: textBody,
        htmlBody,
        timeoutMs: parseInt(process.env.EMAIL_PROVIDER_TIMEOUT_MS || "30000"),
      })) as any; // provider result object (your helpers return structured object)

      // If provider returns structured { success: true/false }
      const success = result?.success === true;

      if (success) {
        // mark sent and ack
        attemptCount = attemptCount + 1;
        await pool.query(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["sent", attemptCount, null, job.notif_id]
        );

        logger.info(
          JSON.stringify({
            notif_id: job.notif_id,
            to: destination,
            attempt: attemptCount,
            status: "sent",
            provider: result,
          })
        );
        this.safeAck(msg);
        return;
      } else {
        // provider failed (but responded)
        attemptCount = attemptCount + 1;

        const errorBlob = result?.error ?? result ?? { message: "Unknown" };

        if (attemptCount >= this.maxRetries) {
          // mark failed and send to DLQ
          await pool.query(
            "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
            ["failed", attemptCount, JSON.stringify(errorBlob), job.notif_id]
          );

          logger.error(
            JSON.stringify({
              notif_id: job.notif_id,
              to: destination,
              attempt: attemptCount,
              reason: "Max retries reached",
              error: errorBlob,
            })
          );

          // send to DLQ (nack without requeue)
          this.safeNack(msg, false, false);
          return;
        }

        // schedule retry
        await pool.query(
          "UPDATE notifications SET attempts=$1, last_error=$2, updated_at=now() WHERE id=$3",
          [attemptCount, JSON.stringify(errorBlob), job.notif_id]
        );

        const retryDelayMs = Math.pow(2, attemptCount) * 60 * 60 * 6 * 1000; // same backoff you used
        await publishDeliveryDelayed(
          { ...job, attempts: attemptCount },
          retryDelayMs
        );

        logger.warn(
          JSON.stringify({
            notif_id: job.notif_id,
            to: destination,
            attempt: attemptCount,
            reason: "Retry scheduled",
            retryDelayMs,
            error: errorBlob,
          })
        );

        // ack this message (we moved to delayed queue)
        this.safeAck(msg);
        return;
      }
    } catch (err: unknown) {
      // network timeout or unexpected error
      const errMsg = err instanceof Error ? err.message : String(err);
      attemptCount = attemptCount + 1;

      logger.warn(
        JSON.stringify({
          notif_id: job.notif_id,
          to: destination,
          attempt: attemptCount,
          reason: "Exception during send",
          error: errMsg,
        })
      );

      // update attempts & last_error
      await pool.query(
        "UPDATE notifications SET attempts=$1, last_error=$2, updated_at=now() WHERE id=$3",
        [attemptCount, errMsg, job.notif_id]
      );

      if (attemptCount >= this.maxRetries) {
        // mark failed and nack to DLQ
        await pool.query(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["failed", attemptCount, errMsg, job.notif_id]
        );

        logger.error(
          JSON.stringify({
            notif_id: job.notif_id,
            to: destination,
            attempt: attemptCount,
            reason: "Max retries reached after exception",
            error: errMsg,
          })
        );

        this.safeNack(msg, false, false);
      } else {
        // schedule delayed retry and ack
        const retryDelayMs = Math.pow(2, attemptCount) * 60 * 60 * 6 * 1000;
        await publishDeliveryDelayed(
          { ...job, attempts: attemptCount },
          retryDelayMs
        );

        logger.warn(
          JSON.stringify({
            notif_id: job.notif_id,
            to: destination,
            attempt: attemptCount,
            reason: "Exception - scheduled retry",
            retryDelayMs,
            error: errMsg,
          })
        );

        this.safeAck(msg);
      }
    }
  }
}
