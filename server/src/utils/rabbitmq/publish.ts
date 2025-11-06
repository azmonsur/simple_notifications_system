import { publishDelivery, closeConnection } from "../rabbitmq";

async function main() {
  try {
    await publishDelivery({
      id: "123",
      message: "Hello from Node.js + Docker!",
    });
  } catch (err) {
    console.error("❌ Publish failed:", err);
  } finally {
    await closeConnection();
  }
}

main();
