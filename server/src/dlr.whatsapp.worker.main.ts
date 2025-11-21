import { NestFactory } from "@nestjs/core";
import { WhatsAppDlrWorkerModule } from "./workers/dlr/whatsapp_meta/whatsapp.worker.module";
import { logger } from "./utils/logger";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    WhatsAppDlrWorkerModule,
    {
      logger: ["log", "error", "warn", "debug"],
    }
  );

  logger.info("🚀 WhatsApp DLR Worker service started successfully.");

  // Note: we don't close app context — it keeps running as a worker
}
bootstrap().catch((err) => {
  console.error("❌ Failed to start WhatsApp DLR Worker:", err);
  process.exit(1);
});
