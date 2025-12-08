import { NestFactory } from "@nestjs/core";
import { WhatsappWorkerModule } from "./workers/notification/whatsapp/whatsapp.worker.module";
import { logger } from "./utils/logger/logger";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WhatsappWorkerModule, {
    logger: ["log", "error", "warn", "debug"],
  });

  logger.info("🚀 WhatsApp Worker service started successfully.");

  // Note: we don't close app context — it keeps running as a worker
}
bootstrap().catch((err) => {
  console.error("❌ Failed to start WhatsApp Worker:", err);
  process.exit(1);
});
