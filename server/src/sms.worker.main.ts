// src/sms.worker.main.ts
import { NestFactory } from "@nestjs/core";
import { SmsWorkerModule } from "./workers/notification/sms/sms.worker.module";
import { SmsWorkerService } from "./workers/notification/sms/sms.worker";
import { logger } from "./utils/logger";
import * as dotenv from "dotenv";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SmsWorkerModule);
  const worker = app.get(SmsWorkerService);

  await worker.onModuleInit();
  logger.info("🚀 SMS Worker started and ready to process messages.");
}
bootstrap().catch((err) => {
  logger.error("❌ Failed to start SMS Worker:", err);
  process.exit(1);
});
