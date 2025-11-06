// src/main.ts
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { json } from "body-parser";
import * as dotenv from "dotenv";
import { logger } from "./utils/logger";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove unknown properties
      forbidNonWhitelisted: true, // throw error on unknown properties
      transform: true, // auto-transform plain objects to DTO instances
    })
  );

  app.use(helmet());
  app.use(json({ limit: "100kb" }));

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.info(`Notification server listening on ${port}`);
}
bootstrap();
