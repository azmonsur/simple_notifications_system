// src/utils/rabbitmq.ts
import * as amqp from "amqplib";
import type { Connection, Channel } from "amqplib";
import { logger } from "./logger";

import * as dotenv from "dotenv";
dotenv.config();

let conn: Connection | null = null;
let channel: Channel | null = null;
let connecting = false;

interface RequeuePayload {
  notif_id: string;
  channel: string;
}

// MAIN queues
const CHANNEL_QUEUES: Record<string, string> = {
  sms: "notifications.sms",
  whatsapp: "notifications.whatsapp",
  email: "notifications.email",
};

// DLQs
const DLQ_QUEUES: Record<string, string> = {
  sms: "notifications.sms.dlq",
  whatsapp: "notifications.whatsapp.dlq",
  email: "notifications.email.dlq",
};

// delayed queues
const DELAYED_QUEUES: Record<string, string> = {
  sms: "notifications.sms.delayed",
  whatsapp: "notifications.whatsapp.delayed",
  email: "notifications.email.delayed",
};

// requeue queue
const REQUEUE_QUEUE = "notifications.requeue";

const RABBITMQ_URL =
  process.env.NODE_ENV === "production"
    ? (process.env.RABBITMQ_URL_PROD as string)
    : (process.env.RABBITMQ_URL_DEV as string);

async function connect(): Promise<Channel> {
  if (channel) return channel;

  if (connecting) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (channel) {
          clearInterval(interval);
          resolve(channel);
        }
      }, 100);
    });
  }

  try {
    connecting = true;
    logger.info("⏳ Connecting to RabbitMQ...");

    conn = await amqp.connect(RABBITMQ_URL);

    conn.on("error", (err) =>
      logger.error("❌ RabbitMQ connection error:", err)
    );
    conn.on("close", () => {
      logger.warn("⚠️ RabbitMQ connection closed. Reconnecting...");
      channel = null;
      conn = null;
      reconnect();
    });

    channel = (await (conn as any).createConfirmChannel()) as Channel;

    channel.on("error", (err) =>
      logger.error("❌ RabbitMQ channel error:", err)
    );
    channel.on("close", () => {
      logger.warn("⚠️ RabbitMQ channel closed. Recreating channel...");
      channel = null;
      reconnect();
    });

    // assert standard queues + DLQ + delayed
    for (const [ch, queueName] of Object.entries(CHANNEL_QUEUES)) {
      await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": DLQ_QUEUES[ch],
        },
      });

      await channel.assertQueue(DLQ_QUEUES[ch], { durable: true });

      if (DELAYED_QUEUES[ch]) {
        await channel.assertQueue(DELAYED_QUEUES[ch], {
          durable: true,
          arguments: {
            "x-dead-letter-exchange": "",
            "x-dead-letter-routing-key": CHANNEL_QUEUES[ch],
          },
        });
      }
    }

    // ✅ assert the requeue cleanup queue
    await channel.assertQueue(REQUEUE_QUEUE, { durable: true });

    logger.info("✅ RabbitMQ connected and all queues ready");
    return channel;
  } catch (err) {
    logger.error("❌ RabbitMQ connection failed, retrying in 3s...", err);
    channel = null;
    conn = null;
    setTimeout(connect, 3000);
    throw err;
  } finally {
    connecting = false;
  }
}

export async function getChannel(): Promise<Channel> {
  if (channel) return channel;
  return connect();
}

export async function publishDelivery(payload: any): Promise<void> {
  if (!payload.channel) throw new Error("Payload must include channel");
  const queue = CHANNEL_QUEUES[payload.channel];
  if (!queue) throw new Error(`Unknown channel: ${payload.channel}`);

  const ch = await getChannel();
  const sent = ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });

  if (sent) logger.info(`📨 Message sent to ${queue}`);
  else logger.warn(`⚠️ Message not sent — queue may be full`);
}

export async function publishDeliveryDelayed(payload: any, delayMs: number) {
  if (!payload.channel) throw new Error("Payload must include channel");
  const baseQueue = CHANNEL_QUEUES[payload.channel];
  if (!baseQueue) throw new Error(`Unknown channel: ${payload.channel}`);

  const delayedQueue = DELAYED_QUEUES[payload.channel];
  if (!delayedQueue) throw new Error("Delayed queue not defined for channel");

  const ch = await getChannel();
  const sent = ch.sendToQueue(
    delayedQueue,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true, expiration: delayMs }
  );

  if (sent) logger.info(`⏳ Delayed → ${delayedQueue} (${delayMs}ms)`);
  else logger.warn(`⚠️ Delayed message NOT sent`);
}

// ✅ NEW: publish into requeue queue
// ✅ NEW: publish into requeue queue (safe, typed)

export async function publishRequeue(payload: RequeuePayload): Promise<void> {
  if (!payload.notif_id || !payload.channel) {
    throw new Error("Requeue payload must include notif_id and channel");
  }

  const ch = await getChannel();
  const sent = ch.sendToQueue(
    REQUEUE_QUEUE,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
    }
  );

  if (sent)
    logger.info(
      `♻️ Sent notif_id ${payload.notif_id} to requeue cleanup queue`
    );
  else
    logger.warn(`⚠️ Requeue cleanup message for ${payload.notif_id} not sent`);
}

export async function closeConnection(): Promise<void> {
  try {
    if (channel) {
      await channel.close();
      logger.info("❎ RabbitMQ channel closed");
      channel = null;
    }
    if (conn) {
      await conn.close();
      logger.info("❎ RabbitMQ connection closed");
      conn = null;
    }
  } catch (err) {
    logger.error("⚠️ Error closing RabbitMQ connection:", err);
  }
}

async function reconnect() {
  try {
    await connect();
  } catch {
    // connect() handles retry
  }
}
