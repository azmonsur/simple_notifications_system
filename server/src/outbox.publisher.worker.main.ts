// src/outbox.worker.main.ts
import { NestFactory } from "@nestjs/core";
import { OutboxWorkerModule } from "./workers/outbox/outbox.publisher.worker.module";
import { logger } from "./utils/logger/logger";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(OutboxWorkerModule, {
    logger: ["log", "error", "warn", "debug"],
  });

  logger.info("🚀 Outbox Worker service started successfully.");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("🛑 Received SIGINT, shutting down gracefully...");
    await app.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("🛑 Received SIGTERM, shutting down gracefully...");
    await app.close();
    process.exit(0);
  });

  // Note: we don't close app context — it keeps running as a worker
}

bootstrap().catch((err) => {
  console.error("❌ Failed to start Outbox Worker:", err);
  process.exit(1);
});
