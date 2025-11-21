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

/* =========================
   DLR (provider-based) QUEUES
   Termii, SendGrid, WhatsApp Meta are added
   ========================= */

// DLR queues (provider based)
const DLR_QUEUES: Record<string, string> = {
  termii: "dlr.termii",
  sendgrid: "dlr.sendgrid",
  whatsapp_meta: "dlr.whatsapp.meta",
};

// DLR delayed queues
const DLR_DELAYED_QUEUES: Record<string, string> = {
  termii: "dlr.termii.delayed",
  sendgrid: "dlr.sendgrid.delayed",
  whatsapp_meta: "dlr.whatsapp.meta.delayed",
};

// DLR DLQs
const DLR_DLQ_QUEUES: Record<string, string> = {
  termii: "dlr.termii.dlq",
  sendgrid: "dlr.sendgrid.dlq",
  whatsapp_meta: "dlr.whatsapp.meta.dlq",
};

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

    /* =========================
       ASSERT DLR QUEUES (provider-based)
       Termii, SendGrid, WhatsApp Meta
       ========================= */
    for (const provider of Object.keys(DLR_QUEUES)) {
      const main = DLR_QUEUES[provider];
      const dlq = DLR_DLQ_QUEUES[provider];
      const delayed = DLR_DELAYED_QUEUES[provider];

      // main dlr queue -> routes to provider DLQ on failure
      await channel.assertQueue(main, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": dlq,
        },
      });

      // provider DLQ
      await channel.assertQueue(dlq, { durable: true });

      // delayed queue for provider retries (messages there TTL -> bounce back to main queue)
      await channel.assertQueue(delayed, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": main,
        },
      });
    }

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

/* =========================
   DLR PUBLISHER HELPERS
   Use these from your webhook controllers:
     publishDLR("termii", payload)
     publishDLRDelayed("termii", payload, 15000) // 15s
   ========================= */

export async function publishDLR(
  provider: keyof typeof DLR_QUEUES,
  payload: any
): Promise<void> {
  const queue = DLR_QUEUES[provider];
  if (!queue) throw new Error(`Unknown DLR provider: ${provider}`);

  const ch = await getChannel();
  const sent = ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
  });

  if (sent) logger.info(`📨 DLR published to ${queue}`);
  else logger.warn(`⚠️ DLR not published — queue may be full: ${queue}`);
}

export async function publishDLRDelayed(
  provider: keyof typeof DLR_DELAYED_QUEUES,
  payload: any,
  delayMs: number,
  attempt: number = 1 // default attempt = 1
): Promise<void> {
  const queue = DLR_DELAYED_QUEUES[provider];
  if (!queue) throw new Error(`No delayed DLR queue for provider: ${provider}`);

  const ch = await getChannel();
  const sent = ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    expiration: delayMs,
    headers: { "x-attempt": attempt }, // pass the current attempt
  });

  if (sent)
    logger.info(`⏳ DLR Delayed → ${queue} (${delayMs}ms, attempt=${attempt})`);
  else logger.warn(`⚠️ DLR delayed message NOT sent → ${queue}`);
}

/* Optionally you can directly route to provider DLQ programmatically:
   export async function publishDLRToDLQ(provider: keyof typeof DLR_DLQ_QUEUES, payload: any) { ... }
   but it's not implemented by default — your workers should decide when to ack -> dlq by rejecting/negative-acking.
*/

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
