// src/utils/rabbitmq.ts
import * as amqp from "amqplib";
import type { Connection, Channel } from "amqplib";
import { logger } from "../logger/logger";

import * as dotenv from "dotenv";
dotenv.config();

let conn: Connection | null = null;
let channel: Channel | null = null;
let connecting = false;

type ConfirmChannel = Channel & {
  waitForConfirms(): Promise<void>;
};

interface RequeuePayload {
  notif_id: string;
  channel: string;
}

type ChannelKey = keyof typeof CHANNEL_QUEUES;
type DLRKey = keyof typeof DLR_QUEUES;

//
// MAIN queues
//
export const CHANNEL_QUEUES = {
  sms: "notifications.sms",
  whatsapp: "notifications.whatsapp",
  email: "notifications.email",
} as const;

//
// DLQs
//
const DLQ_QUEUES: Record<string, string> = {
  sms: "notifications.sms.dlq",
  whatsapp: "notifications.whatsapp.dlq",
  email: "notifications.email.dlq",
};

//
// REQUEUE (cleanup) queue
//
const REQUEUE_QUEUE = "notifications.requeue";

//
// DLR (provider-based) QUEUES
//
const DLR_QUEUES = {
  termii: "dlr.termii",
  sendgrid: "dlr.sendgrid",
  whatsapp_meta: "dlr.whatsapp.meta",
} as const;

const DLR_DLQ_QUEUES: Record<string, string> = {
  termii: "dlr.termii.dlq",
  sendgrid: "dlr.sendgrid.dlq",
  whatsapp_meta: "dlr.whatsapp.meta.dlq",
};

//
// Bucket definitions (ordered arrays) - attempt indexes map to attempts (attempt 1 -> index 0)
// NOTE: tune TTLs to your desired retry backoffs
//
export const SMS_DELAY_BUCKETS: Array<{ queue: string; ttl: number }> = [
  { queue: "notifications.sms.delayed.30s", ttl: 30_000 },
  { queue: "notifications.sms.delayed.2m", ttl: 120_000 },
  { queue: "notifications.sms.delayed.5m", ttl: 300_000 },
];

export const WHATSAPP_DELAY_BUCKETS: Array<{ queue: string; ttl: number }> = [
  { queue: "notifications.whatsapp.delayed.30s", ttl: 30_000 },
  { queue: "notifications.whatsapp.delayed.2m", ttl: 120_000 },
  { queue: "notifications.whatsapp.delayed.5m", ttl: 300_000 },
];

export const EMAIL_DELAY_BUCKETS: Array<{ queue: string; ttl: number }> = [
  { queue: "notifications.email.delayed.1m", ttl: 60_000 },
  { queue: "notifications.email.delayed.5m", ttl: 300_000 },
  { queue: "notifications.email.delayed.10m", ttl: 600_000 },
];

export const DLR_TERMII_BUCKETS: Array<{ queue: string; ttl: number }> = [
  { queue: "dlr.termii.delayed.10s", ttl: 10_000 },
  { queue: "dlr.termii.delayed.30s", ttl: 30_000 },
  { queue: "dlr.termii.delayed.2m", ttl: 120_000 },
];

export const DLR_SENDGRID_BUCKETS: Array<{ queue: string; ttl: number }> = [
  { queue: "dlr.sendgrid.delayed.10s", ttl: 10_000 },
  { queue: "dlr.sendgrid.delayed.30s", ttl: 30_000 },
  { queue: "dlr.sendgrid.delayed.2m", ttl: 120_000 },
];

export const DLR_WHATSAPP_META_BUCKETS: Array<{ queue: string; ttl: number }> =
  [
    { queue: "dlr.whatsapp.meta.delayed.10s", ttl: 10_000 },
    { queue: "dlr.whatsapp.meta.delayed.30s", ttl: 30_000 },
    { queue: "dlr.whatsapp.meta.delayed.2m", ttl: 120_000 },
  ];

//
// Map channel key -> buckets (for easy lookup in helpers)
//
const CHANNEL_DELAY_BUCKETS: Record<
  ChannelKey,
  Array<{ queue: string; ttl: number }>
> = {
  sms: SMS_DELAY_BUCKETS,
  whatsapp: WHATSAPP_DELAY_BUCKETS,
  email: EMAIL_DELAY_BUCKETS,
};

const DLR_DELAY_BUCKETS: Record<
  DLRKey,
  Array<{ queue: string; ttl: number }>
> = {
  termii: DLR_TERMII_BUCKETS,
  sendgrid: DLR_SENDGRID_BUCKETS,
  whatsapp_meta: DLR_WHATSAPP_META_BUCKETS,
};

//
// RabbitMQ URL
//
const RABBITMQ_URL =
  process.env.NODE_ENV === "production"
    ? (process.env.RABBITMQ_URL_PROD as string)
    : (process.env.RABBITMQ_URL_DEV as string);

//
// Connect & assert queues (dynamic)
//
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

    // Assert main channel queues, DLQs and bucket queues for each channel
    for (const chKey of Object.keys(CHANNEL_QUEUES) as ChannelKey[]) {
      const queueName = CHANNEL_QUEUES[chKey];
      const dlqName = DLQ_QUEUES[chKey];

      // main queue -> routes to DLQ on final failure if worker decides to send to DLQ programmatically
      await channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": dlqName,
        },
      });

      // DLQ
      await channel.assertQueue(dlqName, { durable: true });

      // assert bucket delayed queues (each bucket has TTL and dead-letters back to main queue)
      const buckets = CHANNEL_DELAY_BUCKETS[chKey];
      if (buckets && buckets.length > 0) {
        for (const b of buckets) {
          await channel.assertQueue(b.queue, {
            durable: true,
            arguments: {
              "x-message-ttl": b.ttl,
              "x-dead-letter-exchange": "",
              "x-dead-letter-routing-key": queueName,
            },
          });
        }
      }
    }

    // assert requeue cleanup queue
    await channel.assertQueue(REQUEUE_QUEUE, { durable: true });

    // DLR queues + buckets + DLQs
    for (const provider of Object.keys(DLR_QUEUES) as DLRKey[]) {
      const main = DLR_QUEUES[provider];
      const dlq = DLR_DLQ_QUEUES[provider];

      await channel.assertQueue(main, {
        durable: true,
        arguments: {
          "x-dead-letter-exchange": "",
          "x-dead-letter-routing-key": dlq,
        },
      });

      await channel.assertQueue(dlq, { durable: true });

      const buckets = DLR_DELAY_BUCKETS[provider];
      if (buckets && buckets.length > 0) {
        for (const b of buckets) {
          await channel.assertQueue(b.queue, {
            durable: true,
            arguments: {
              "x-message-ttl": b.ttl,
              "x-dead-letter-exchange": "",
              "x-dead-letter-routing-key": main,
            },
          });
        }
      }
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

//
// Helper: get bucket by attempt (attempt is 1-based)
// returns the bucket object or null (meaning no bucket => send to DLQ)
//
function getChannelBucket(channelKey: ChannelKey, attempt: number) {
  const buckets = CHANNEL_DELAY_BUCKETS[channelKey] ?? [];
  return buckets[attempt - 1] ?? null;
}

function getDLRBucket(provider: DLRKey, attempt: number) {
  const buckets = DLR_DELAY_BUCKETS[provider] ?? [];
  return buckets[attempt - 1] ?? null;
}

//
// Generic helper: safe publish
//
async function safeSendToQueue(
  ch: Channel,
  queue: string,
  payload: any,
  headers?: Record<string, any>
) {
  const sent = ch.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    headers: headers ?? {},
  });

  if (sent) logger.info(`📨 Sent message to ${queue}`);
  else logger.warn(`⚠️ Message not sent — queue may be full: ${queue}`);
  return sent;
}

//
// PUBLIC: publishDelivery (initial publish to main channel queues)
//
export async function publishDelivery(payload: any): Promise<void> {
  if (!payload.channel) throw new Error("Payload must include channel");
  const channelKey = payload.channel as ChannelKey;
  const queue = CHANNEL_QUEUES[channelKey];
  if (!queue) throw new Error(`Unknown channel: ${payload.channel}`);

  const ch = await getChannel();
  await safeSendToQueue(ch, queue, {
    ...payload,
    attempt: payload.attempt ?? 1,
  });
  logger.info(`📨 Message sent to ${queue}`);
}

// --- Batch send to arbitrary queue
export async function publishBatchToQueue(
  queue: string,
  payloads: any[],
  headers?: Record<string, any>
) {
  if (!payloads.length) return;
  const ch = await getChannel();

  for (const payload of payloads) {
    await safeSendToQueue(ch, queue, payload, headers);
  }

  logger.info(`📨 Batch published to ${queue} (${payloads.length} messages)`);
}

export async function publishDeliveryBatch(payloads: any[]) {
  if (!payloads.length) return;

  const ch = await getChannel();
  const grouped: Record<string, any[]> = {};

  // Group payloads by channel
  for (const payload of payloads) {
    if (!payload.channel) continue;
    grouped[payload.channel] = grouped[payload.channel] ?? [];
    grouped[payload.channel].push(payload);
  }

  // Send each channel's batch
  for (const [channelKey, batch] of Object.entries(grouped)) {
    const queue = CHANNEL_QUEUES[channelKey as ChannelKey];
    if (!queue) continue;
    await publishBatchToQueue(queue, batch);
  }
}

//
// PUBLIC: publishDeliveryToBucket (used by workers to forward failed job to bucket)
// - attempt param is the *current* attempt (1-based). Worker should pass current attempt
// - the function will publish with attempt + 1 so the message moves through buckets
//
export async function publishDeliveryToBucket(
  channelKeyStr: string,
  payload: any,
  attempt: number
) {
  const channelKey = channelKeyStr as ChannelKey;
  const ch = await getChannel();

  const buckets = CHANNEL_DELAY_BUCKETS[channelKey] ?? [];
  const safeAttempt = Math.max(1, Math.min(attempt, buckets.length + 1));

  const bucket = getChannelBucket(channelKey, safeAttempt);
  if (bucket) {
    const nextAttempt = safeAttempt + 1;
    await safeSendToQueue(
      ch,
      bucket.queue,
      { ...payload, attempt: nextAttempt },
      { "x-attempt": nextAttempt }
    );
    logger.info(
      `⏳ Delivery -> ${bucket.queue} (attempt=${nextAttempt}, ttl=${bucket.ttl}ms)`
    );
    return;
  }

  const dlq = DLQ_QUEUES[channelKey];
  if (!dlq) throw new Error(`No DLQ defined for channel ${channelKey}`);

  await safeSendToQueue(
    ch,
    dlq,
    { ...payload, attempt: safeAttempt },
    { "x-final": true }
  );
  logger.info(`🛑 Delivery moved to DLQ ${dlq} (attempt=${safeAttempt})`);
}

//
// PUBLIC: publishDLR (initial publish to main DLR queue)
//
export async function publishDLR(
  provider: DLRKey,
  payload: any
): Promise<void> {
  const queue = DLR_QUEUES[provider];
  if (!queue) throw new Error(`Unknown DLR provider: ${provider}`);

  const ch = await getChannel();
  await safeSendToQueue(ch, queue, {
    ...payload,
    attempt: payload.attempt ?? 1,
  });
  logger.info(`📨 DLR published to ${queue}`);
}

//
// PUBLIC: publishDLRToBucket (used by DLR workers to forward failed job to bucket)
//
export async function publishDLRToBucket(
  providerStr: string,
  payload: any,
  attempt: number
) {
  const provider = providerStr as DLRKey;
  const ch = await getChannel();

  const buckets = DLR_DELAY_BUCKETS[provider] ?? [];
  const safeAttempt = Math.max(1, Math.min(attempt, buckets.length + 1));

  const bucket = getDLRBucket(provider, safeAttempt);
  if (bucket) {
    const nextAttempt = safeAttempt + 1;
    await safeSendToQueue(
      ch,
      bucket.queue,
      { ...payload, attempt: nextAttempt },
      { "x-attempt": nextAttempt }
    );
    logger.info(
      `⏳ DLR -> ${bucket.queue} (provider=${provider}, attempt=${nextAttempt}, ttl=${bucket.ttl}ms)`
    );
    return;
  }

  const dlq = DLR_DLQ_QUEUES[provider];
  if (!dlq) throw new Error(`No DLR DLQ defined for provider ${provider}`);

  await safeSendToQueue(
    ch,
    dlq,
    { ...payload, attempt: safeAttempt },
    { "x-final": true }
  );
  logger.info(
    `🛑 DLR moved to DLQ ${dlq} (provider=${provider}, attempt=${safeAttempt})`
  );
}

//
// Requeue publisher (unchanged)
//
export async function publishRequeue(payload: RequeuePayload): Promise<void> {
  if (!payload.notif_id || !payload.channel) {
    throw new Error("Requeue payload must include notif_id and channel");
  }

  const ch = await getChannel();
  await safeSendToQueue(ch, REQUEUE_QUEUE, payload);
  logger.info(`♻️ Sent notif_id ${payload.notif_id} to requeue cleanup queue`);
}

//
// close/reconnect helpers (unchanged)
//
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
