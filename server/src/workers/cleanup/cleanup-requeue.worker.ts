// src/workers/cleanup/cleanup-requeue.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { getChannel } from "../../utils/rabbitmq/rabbitmq";
import { logger } from "../../utils/logger/logger";

interface ConsumeMessage {
  content: Buffer;
  fields: any;
  properties: any;
}

interface ConfirmChannel {
  consume: (
    queue: string,
    onMessage: (msg: ConsumeMessage | null) => void,
    options?: any
  ) => Promise<{ consumerTag: string }>;
  ack: (msg: ConsumeMessage) => void;
  nack: (msg: ConsumeMessage, allUpTo?: boolean, requeue?: boolean) => void;
  prefetch: (count: number) => void;
  cancel?: (consumerTag: string) => Promise<void>;
  close?: () => Promise<void>;
}

interface RequeueJob {
  notif_id: string;
  channel: keyof CleanupWorkerService["DLQ_QUEUES"];
}

@Injectable()
export class CleanupWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly requeueQueue = "notifications.requeue";

  private readonly DLQ_QUEUES: Record<string, string> = {
    sms: "notifications.sms.dlq",
    whatsapp: "notifications.whatsapp.dlq",
    email: "notifications.email.dlq",
  };

  private channel: ConfirmChannel | null = null;
  private readonly BATCH_SIZE = 50;

  async onModuleInit() {
    logger.info("♻️ Cleanup Worker starting...");

    const ch = await getChannel();
    if (!ch) {
      logger.error("❌ Failed to get RabbitMQ channel for Cleanup Worker.");
      return;
    }

    this.channel = ch as unknown as ConfirmChannel;
    this.channel.prefetch(5);

    await this.channel.consume(
      this.requeueQueue,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;
        await this.processRequeueJob(msg);
      },
      { noAck: false }
    );

    logger.info(`✅ Cleanup Worker consuming from ${this.requeueQueue}`);
  }

  async onModuleDestroy() {
    if (this.channel?.close) await this.channel.close();
    logger.info("🧹 Cleanup Worker stopped.");
  }

  private async processRequeueJob(msg: ConsumeMessage) {
    try {
      const job: RequeueJob = JSON.parse(msg.content.toString());
      const { notif_id, channel: notifChannel } = job;

      if (!notif_id || !notifChannel) {
        logger.error("❌ Invalid requeue job:", job);
        return this.safeAck(msg);
      }

      const dlqName = this.DLQ_QUEUES[notifChannel];
      if (!dlqName) {
        logger.error(`❌ Unknown DLQ channel: ${notifChannel}`);
        return this.safeAck(msg);
      }

      logger.info(`🔍 Cleaning DLQ ${dlqName} for notif_id ${notif_id}...`);

      let processed = 0;
      let removed = false;

      // Start temporary DLQ consumer
      const { consumerTag } = await this.channel!.consume(
        dlqName,
        (dlqMsg: ConsumeMessage | null) => {
          if (!dlqMsg) return;

          try {
            const content = JSON.parse(dlqMsg.content.toString());

            if (content.notif_id === notif_id) {
              console.log("content.notif_id ", content.notif_id);
              this.channel!.ack(dlqMsg);
              removed = true;

              logger.info(`🧹 Removed message from DLQ (${notif_id})`);
            } else {
              this.channel!.nack(dlqMsg, false, true);
            }
          } catch (err) {
            logger.error("❌ Failed to parse DLQ message:", err);
            this.channel!.nack(dlqMsg, false, true);
          }

          processed++;

          if (processed >= this.BATCH_SIZE) {
            this.channel!.cancel!(consumerTag).catch((err) =>
              logger.error("❌ Failed to cancel DLQ consumer:", err)
            );
          }
        },
        { noAck: false }
      );

      // Safety timeout to guarantee consumer is removed
      setTimeout(() => {
        this.channel!.cancel!(consumerTag).catch(() => {});
      }, 3000);

      if (!removed) {
        logger.warn(
          `⚠️ No message found in DLQ for notif_id ${notif_id} and DLQ ${dlqName}`
        );
      }

      this.safeAck(msg);
      logger.info(`✅ Cleanup job complete for ${notif_id}`);
    } catch (err) {
      logger.error("❌ Cleanup worker error:", err);
      this.safeNack(msg, false, true);
    }
  }

  private safeAck(msg: ConsumeMessage) {
    try {
      this.channel?.ack(msg);
    } catch (err) {
      logger.error("safeAck failed:", err);
    }
  }

  private safeNack(msg: ConsumeMessage, allUpTo = false, requeue = false) {
    try {
      this.channel?.nack(msg, allUpTo, requeue);
    } catch (err) {
      logger.error("safeNack failed:", err);
    }
  }
}
