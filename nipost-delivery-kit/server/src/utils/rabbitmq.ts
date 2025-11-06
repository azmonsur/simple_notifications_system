import * as amqp from 'amqplib';
import { logger } from './logger';

let conn: amqp.Connection | null = null;
let channel: amqp.ConfirmChannel | null = null;

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'notifications.exchange';
const DELIVERY_QUEUE = process.env.RABBITMQ_DELIVERY_QUEUE || 'notifications.delivery';
const DLQ = process.env.RABBITMQ_DLQ || 'notifications.dlq';

export async function getChannel() {
  if (channel) return channel;
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
  conn = await amqp.connect(url);
  channel = await conn.createConfirmChannel();
  // create a topic exchange for routing by channel
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  // delivery queue bound to exchange for all channels
  await channel.assertQueue(DELIVERY_QUEUE, { durable: true });
  await channel.bindQueue(DELIVERY_QUEUE, EXCHANGE, 'notifications.*');
  // dead letter queue
  await channel.assertQueue(DLQ, { durable: true });
  logger.info('Connected to RabbitMQ (exchange, queues asserted)');
  return channel;
}

// publish to exchange using routing key "notifications.<channel>"
export async function publishDelivery(payload: any) {
  const ch = await getChannel();
  const routingKey = `notifications.${payload.channel || 'unknown'}`;
  return new Promise<void>((resolve, reject) => {
    ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true }, (err) => {
      if (err) {
        logger.error('publishDelivery error', err);
        return reject(err);
      }
      resolve();
    });
  });
}

// requeue with attempts increment; if exceeded maxAttempts push to DLQ
export async function requeueOrDLQ(payload: any, maxAttempts = 5) {
  const ch = await getChannel();
  const attempts = (payload.attempts || 0) + 1;
  payload.attempts = attempts;
  if (attempts > maxAttempts) {
    // send to DLQ for manual inspection
    ch.sendToQueue(DLQ, Buffer.from(JSON.stringify(payload)), { persistent: true });
    logger.warn('Moved to DLQ', { id: payload.notif_id });
    return;
  }
  // publish back to exchange for retry - consumers should handle attempts
  const routingKey = `notifications.${payload.channel || 'unknown'}`;
  return new Promise<void>((resolve, reject) => {
    ch.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true }, (err) => {
      if (err) {
        logger.error('requeue publish error', err);
        return reject(err);
      }
      logger.info('Requeued message', { id: payload.notif_id, attempts });
      resolve();
    });
  });
}