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
  try {
    const app = await NestFactory.create(AppModule, { logger: false });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    app.use(helmet());
    app.use(json({ limit: "100kb" }));

    // ✅ Enable CORS
    app.enableCors({
      origin: "*", // allow all origins
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
      allowedHeaders: "Content-Type, Accept, Authorization",
    });

    const port = process.env.PORT || 3000;
    await app.listen(port);

    logger.info(`Notification server listening on ${port}`);
  } catch (error) {
    logger.error(error);
  }
}
bootstrap();
