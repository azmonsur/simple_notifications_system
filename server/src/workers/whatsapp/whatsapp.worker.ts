import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel, publishDeliveryDelayed } from "../../utils/rabbitmq";
import { logger } from "../../utils/logger";
import SendWhatsAppCloud from "../../helpers/sendWhatsappCloud";
import { query as dbQuery } from "../../utils/db";

// --- Interfaces ---
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
  attempts?: number;
}

// --- RabbitMQ Message ---
type ConsumeMessage = {
  content: Buffer;
  fields: any;
  properties: any;
};

@Injectable()
export class WhatsappWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly queueName = "notifications.whatsapp";
  private readonly maxRetries = 3;
  private readonly prefetchCount = 5;
  private readonly retryBackoffMinutes = [30, 120, 360]; // progressive backoff

  private channel: any = null; // keep as amqplib Channel

  async onModuleInit() {
    logger.info("🚀 Starting WhatsApp Worker...");
    this.channel = await getChannel();

    if (!this.channel) {
      logger.error("❌ Failed to get RabbitMQ channel.");
      return;
    }

    this.channel.prefetch(this.prefetchCount);

    await this.channel.consume(
      this.queueName,
      (msg: ConsumeMessage | null) => this.handleMessage(msg),
      { noAck: false }
    );

    logger.info(`✅ WhatsApp worker consuming from ${this.queueName}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🧹 WhatsApp channel closed gracefully.");
  }

  // --- Message formatter ---
  private formatPlainMessage(job: WhatsAppJob): string {
    const { recipient, template_vars } = job;
    const amount = template_vars.amount ?? 0;
    const formattedAmount = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
    return `Hello ${recipient.name || "Customer"}, your package ${
      template_vars.tracking_number || "N/A"
    } is ${template_vars.status || "pending"}. Amount: ${formattedAmount}`;
  }

  private getTemplateName(job: WhatsAppJob): string {
    const { role, status } = job.template_vars;

    if (role === "sender" && status === "pending") return "sender_queued";
    if (role === "receiver" && status === "pending") return "receiver_queued";
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
    return {
      customer_name: recipient.name || "Customer",
      tracking_number: template_vars.tracking_number || "N/A",
      status: template_vars.status || "N/A",
      amount: (template_vars.amount ?? 0).toString(),
    };
  }

  // --- Message handler ---
  private async handleMessage(msg: ConsumeMessage | null) {
    if (!msg || !this.channel) return;

    let job: WhatsAppJob;
    try {
      job = JSON.parse(msg.content.toString());
    } catch (err) {
      logger.error("❌ Failed to parse WhatsApp job:", err);
      this.channel.nack(msg, false, false);
      return;
    }

    const attempts = job.attempts ?? 0;
    const nextAttempts = attempts + 1;

    if (!job.recipient?.destination) {
      await this.markFailed(job.notif_id, "Missing recipient");
      this.channel.ack(msg);
      return;
    }

    const phone = job.recipient.destination;
    const useTemplate = process.env.WHATSAPP_USE_TEMPLATE === "true";

    const messageOptions = useTemplate
      ? {
          templateName: this.getTemplateName(job),
          templateParams: this.getTemplateParams(job),
        }
      : { body: this.formatPlainMessage(job) };

    try {
      const response = await SendWhatsAppCloud({
        to: phone,
        ...messageOptions,
      });

      if (response?.success) {
        await dbQuery(
          "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
          ["sent", nextAttempts, null, job.notif_id]
        );
        logger.info(
          JSON.stringify({ notif_id: job.notif_id, to: phone, status: "sent" })
        );
        this.channel.ack(msg);
        return;
      }

      await this.markRetry(job, nextAttempts, response, "Non-success response");
    } catch (err) {
      await this.markRetry(job, nextAttempts, err, "WhatsApp API error");
    }

    // Retry logic
    if (nextAttempts > this.maxRetries) {
      await this.markFailed(job.notif_id, "Max retries reached");
      this.channel.nack(msg, false, false);
      return;
    }

    const backoffMinutes =
      this.retryBackoffMinutes[nextAttempts - 1] ??
      this.retryBackoffMinutes[this.retryBackoffMinutes.length - 1];
    const retryDelayMs = backoffMinutes * 60 * 1000;

    job.attempts = nextAttempts;
    await publishDeliveryDelayed(job, retryDelayMs);

    this.channel.ack(msg);
    logger.warn(
      JSON.stringify({
        notif_id: job.notif_id,
        attempts: nextAttempts,
        retryDelayMs,
        reason: "Scheduled WhatsApp retry",
      })
    );
  }

  private async markRetry(
    job: WhatsAppJob,
    attempts: number,
    error: any,
    reason: string
  ) {
    await dbQuery(
      "UPDATE notifications SET status=$1, attempts=$2, last_error=$3, updated_at=now() WHERE id=$4",
      ["queued", attempts, JSON.stringify(error), job.notif_id]
    );
    logger.warn(
      JSON.stringify({
        notif_id: job.notif_id,
        to: job.recipient?.destination,
        reason,
        attempts,
      })
    );
  }

  private async markFailed(notif_id: string, reason: string) {
    await dbQuery(
      "UPDATE notifications SET status=$1, last_error=$2, updated_at=now() WHERE id=$3",
      ["failed", reason, notif_id]
    );
    logger.error(JSON.stringify({ notif_id, reason }));
  }
}
