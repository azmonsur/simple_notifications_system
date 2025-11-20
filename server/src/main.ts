import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import { json } from "body-parser";
import * as dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";
import compression from "compression";
import { logger } from "./utils/logger";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { MetricsMiddleware } from "./middleware/metrics.middleware";
import csurf from "csurf";
import { HttpsOptions } from "@nestjs/common/interfaces/external/https-options.interface";
import { readFileSync } from "fs";

import { migrate } from "./database/migrate-destinations";

dotenv.config();

// export default bootstrap;

async function bootstrap() {
  try {
    // HTTPS configuration
    // const httpsOptions: HttpsOptions = {
    //   key: readFileSync("path/to/private-key.pem"),
    //   cert: readFileSync("path/to/public-certificate.pem"),
    //   ciphers: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256",
    //   honorCipherOrder: true,
    // };

    const app = await NestFactory.create(AppModule, {
      logger: false,
      // logger: ["error", "warn", "log"],
      // httpsOptions,
    });

    // Metrics
    app.use(new MetricsMiddleware().use);

    // Security headers
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'"],
            connectSrc: ["'self'"],
          },
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: { policy: "same-origin" },
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      })
    );

    // Rate limiting
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1500, // limit each IP to 100 requests per windowMs
        message: "Too many requests from this IP, please try again later",
      })
    );

    // const nipostInternalIPs = [
    //   "10.0.0.0/8",
    //   "192.168.1.0/24",
    //   // "::1",
    //   // "127.0.0.1",
    // ];
    // app.use((req: Request, res: Response, next: NextFunction) => {
    //   const ip = req.ip || req.connection.remoteAddress;
    //   if (nipostInternalIPs.some((subnet) => ip?.startsWith(subnet))) {
    //     return next(); // skip rate limiting
    //   }
    //   return rateLimit({
    //     windowMs: 15 * 60 * 1000,
    //     max: 5000,
    //   })(req, res, next);
    // });

    // CSRF protection
    app.use(cookieParser());
    // app.use(
    //   csurf({
    //     cookie: {
    //       httpOnly: true,
    //       secure: true,
    //       sameSite: "strict",
    //     },
    //   })
    // );

    // Strict CORS
    app.enableCors({
      origin: "*", //process.env.ALLOWED_ORIGINS?.split(","),
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Authorization", "Content-Type"],
      credentials: true,
      maxAge: 3600,
    });

    // Additional security measures
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        forbidUnknownValues: true,
        disableErrorMessages: process.env.NODE_ENV === "production",
      })
    );

    const port = process.env.PORT || 3000;
    await app.listen(port, "0.0.0.0", () => {
      logger.info(`Secure notification server listening on ${port}`);
    });
  } catch (error) {
    logger.error("Bootstrap failed:", error);
    process.exit(1);
  }
}

// Uncomment if you want normal single-process dev run
bootstrap();
// migrate();
export default bootstrap;
