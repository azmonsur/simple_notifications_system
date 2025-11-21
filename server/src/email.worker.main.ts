import { NestFactory } from "@nestjs/core";
import { EmailWorkerModule } from "./workers/notification/email/email.worker.module";
import { logger } from "./utils/logger";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(EmailWorkerModule, {
    logger: ["log", "error", "warn", "debug"],
  });

  logger.info("🚀 Email Worker service started successfully.");

  // Note: we don't close app context — it keeps running as a worker
}
bootstrap().catch((err) => {
  console.error("❌ Failed to start Email Worker:", err);
  process.exit(1);
});
