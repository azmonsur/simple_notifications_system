import { getChannel } from "./rabbitmq";

async function consume() {
  const channel = await getChannel();

  await channel.consume(
    "notifications.delivery",
    (msg) => {
      if (msg) {
        console.log("📬 Received message:", msg.content.toString());
        channel.ack(msg);
      }
    },
    { noAck: false }
  );

  console.log("⏳ Waiting for messages...");
}

consume().catch(console.error);
