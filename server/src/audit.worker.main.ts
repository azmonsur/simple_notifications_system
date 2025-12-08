import { NestFactory } from "@nestjs/core";
import { AuditLogWorkerModule } from "./workers/audit/audit.worker.module";
import { logger } from "./utils/logger/logger";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AuditLogWorkerModule, {
    logger: ["log", "error", "warn", "debug"],
  });

  logger.info("🚀 Audit log Worker service started successfully.");

  // Note: we don't close app context — it keeps running as a worker
}
bootstrap().catch((err) => {
  console.error("❌ Failed to start WhatsApp DLR Worker:", err);
  process.exit(1);
});
