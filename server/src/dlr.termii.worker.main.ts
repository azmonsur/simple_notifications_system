import { NestFactory } from "@nestjs/core";
import { TermiiDlrWorkerModule } from "./workers/dlr/termii/termii.worker.module";
import { logger } from "./utils/logger";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    TermiiDlrWorkerModule,
    {
      logger: ["log", "error", "warn", "debug"],
    }
  );

  logger.info("🚀 Termii DLR Worker service started successfully.");

  // Note: we don't close app context — it keeps running as a worker
}
bootstrap().catch((err) => {
  console.error("❌ Failed to start Termii DLR Worker:", err);
  process.exit(1);
});
