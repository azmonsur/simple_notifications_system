import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { json } from "body-parser";
import * as dotenv from "dotenv";
import { Request, Response, NextFunction } from "express";
import compression from "compression";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import csurf from "csurf";
import { HttpsOptions } from "@nestjs/common/interfaces/external/https-options.interface";
import { readFileSync, existsSync } from "fs";
import os from "os";

import { AppModule } from "./app.module";
import { logger } from "./utils/logger";
import { MetricsMiddleware } from "./middleware/metrics.middleware";
import { ConnectionLimiterMiddleware } from "./middleware/connection-limiter.middleware";

dotenv.config();

// Environment validation
function validateEnvironment() {
  const required = ["NODE_ENV"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  // Warn about security-related variables
  if (!process.env.ALLOWED_ORIGINS && process.env.NODE_ENV === "production") {
    logger.warn(
      "ALLOWED_ORIGINS not set - CORS will be disabled in production"
    );
  }
}

// HTTPS configuration helper
function getHttpsOptions(): HttpsOptions | undefined {
  const keyPath = process.env.SSL_KEY_PATH;
  const certPath = process.env.SSL_CERT_PATH;

  if (!keyPath || !certPath) {
    return undefined;
  }

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    logger.warn("SSL certificate files not found, starting without HTTPS");
    return undefined;
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
    ciphers: [
      "ECDHE-ECDSA-AES128-GCM-SHA256",
      "ECDHE-RSA-AES128-GCM-SHA256",
      "ECDHE-ECDSA-AES256-GCM-SHA384",
      "ECDHE-RSA-AES256-GCM-SHA384",
    ].join(":"),
    honorCipherOrder: true,
    // minVersion: "TLSv1.2" as const,
  };
}

// Graceful shutdown handler
function setupGracefulShutdown(app: any, timeoutMs = 30000) {
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown...`);

    // Force exit if graceful shutdown takes too long
    const forceExitTimer = setTimeout(() => {
      logger.error("Graceful shutdown timeout, forcing exit");
      process.exit(1);
    }, timeoutMs);

    try {
      await app.close();
      clearTimeout(forceExitTimer);
      logger.info("Application closed successfully");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown:", error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Unhandled error handlers
function setupErrorHandlers(app: any) {
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    gracefulShutdown(app, 1);
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    gracefulShutdown(app, 1);
  });
}

async function gracefulShutdown(app: any, exitCode: number) {
  try {
    logger.info("Attempting graceful shutdown due to error...");
    await app.close();
    process.exit(exitCode);
  } catch (err) {
    logger.error("Error during graceful shutdown:", err);
    process.exit(1);
  }
}

async function bootstrap() {
  try {
    // Validate environment
    validateEnvironment();

    const isProduction = process.env.NODE_ENV === "production";
    // const httpsOptions = isProduction ? getHttpsOptions() : undefined;

    // Create NestJS application
    const app = await NestFactory.create(AppModule, {
      logger: isProduction
        ? ["error", "warn"]
        : ["error", "warn", "log", "debug"],
      // httpsOptions,
      bodyParser: false, // We'll configure body-parser manually
    });

    // Get underlying Express instance
    // Let server know it's behind a proxy (e.g., load balancer) and treat X-Forwarded-* headers as trusted
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set("trust proxy", 1); // <-- now works

    // Setup error handlers first
    setupErrorHandlers(app);

    // Body parser with size limits
    app.use(
      json({
        limit: process.env.MAX_BODY_SIZE || "10mb",
        verify: (req: any, res, buf) => {
          req.rawBody = buf; // Store raw body for webhook verification if needed
        },
      })
    );

    // Dynamic compression level based on CPU load
    function getCompressionLevel() {
      const cpuUsage = os.loadavg()[0]; // 1-minute average
      const cpuCount = os.cpus().length;
      const usage = (cpuUsage / cpuCount) * 100;

      if (usage > 70) return 3; // High load → fast compression
      if (usage > 40) return 4; // Medium load → balanced
      return 5; // Low load → better compression
    }

    // Dynamic memory level based on usage
    function getDynamicMemLevel() {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

      if (memUsagePercent > 80) return 5; // High memory pressure
      if (memUsagePercent > 60) return 6; // Moderate pressure
      if (memUsagePercent > 40) return 7; // Normal
      return 8; // Plenty of memory
    }

    // Compression
    app.use(
      compression({
        threshold: 1024,

        // Only compress these content types
        filter: (req, res) => {
          if (
            req.headers["x-no-compression"] ||
            req.headers["x-disable-compression"] ||
            req.headers["cf-ray"] ||
            req.headers["x-amz-cf-id"]
          ) {
            return false; // Don't compress if client says no
          }
          return compression.filter(req, res);
        },
        level: getCompressionLevel(),
        // Memory level (1-9, higher = more memory but better compression)
        memLevel: getDynamicMemLevel(),
      })
    );

    // Metrics middleware
    app.use(new MetricsMiddleware().use);

    // Cookie parser (required for CSRF)
    app.use(cookieParser(process.env.COOKIE_SECRET));

    // Security headers
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles if needed
            imgSrc: ["'self'", "data:", "https:"],
            // connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            connectSrc: [
              "'self'",
              "https://api.yoursite.com", // Your API
              "wss://api.yoursite.com", // WebSockets if needed
            ],
          },
        },
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: { policy: "same-origin" },
        crossOriginResourcePolicy: { policy: "same-origin" },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        noSniff: true,
        xssFilter: true,
      })
    );

    // Rate limiting
    const rateLimitWindowMs = 15 * 60 * 1000; // 15 minutes
    const rateLimitMax = isProduction ? 100 : 500; // Stricter in production

    app.use(
      rateLimit({
        windowMs: rateLimitWindowMs,
        max: rateLimitMax,
        message: "Too many requests from this IP, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
        // Skip rate limiting for health checks
        skip: (req) => req.path === "/health" || req.path === "/metrics",
      })
    );

    // CSRF protection (only in production with proper configuration)
    if (isProduction && process.env.ENABLE_CSRF === "true") {
      app.use(
        csurf({
          cookie: {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            signed: true,
          },
        })
      );

      // Add CSRF token to response
      app.use((req: any, res: any, next: any) => {
        res.locals.csrfToken = req.csrfToken?.() || null;
        next();
      });
    }

    // CORS configuration
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) =>
      o.trim()
    );

    if (allowedOrigins && allowedOrigins.length > 0) {
      app.enableCors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, curl, etc.)
          if (!origin) return callback(null, true);

          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        allowedHeaders: ["Authorization", "Content-Type", "X-CSRF-Token"],
        credentials: true,
        maxAge: 3600,
      });
    } else {
      logger.warn("CORS is disabled - no ALLOWED_ORIGINS configured");
    }

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        forbidUnknownValues: true,
        disableErrorMessages: isProduction,
        transformOptions: {
          enableImplicitConversion: false, // Explicit type conversion only
        },
      })
    );

    // Global prefix for API routes
    app.setGlobalPrefix("api/v1", {
      exclude: ["/health", "/metrics"], // Exclude monitoring endpoints
    });

    // Start server
    const port = parseInt(process.env.PORT || "3000", 10);
    const host = process.env.HOST || "0.0.0.0";

    // Per-IP fairness
    const connectionLimiter = new ConnectionLimiterMiddleware({
      maxConnectionsPerIp: parseInt(
        process.env.MAX_CONNECTIONS_PER_IP || "50",
        10
      ),
      maxConnectionsGlobal: parseInt(
        process.env.MAX_CONNECTIONS_GLOBAL || "1000",
        10
      ),
      // whitelistedIps: (process.env.WHITELISTED_IPS || "127.0.0.1,::1").split(
      //   ","
      // ),
    });

    logger.info("Connection stat", connectionLimiter.getStats());

    await app.listen(port, host);

    const server = app.getHttpServer();

    // Set timeouts for idle connections
    server.keepAliveTimeout = 61000; // 61 seconds (must be > load balancer timeout)
    server.headersTimeout = 65000; // 65 seconds (must be > keepAliveTimeout)

    // Close idle connections after 30 seconds
    server.timeout = 30000;

    // Limit connections per IP
    server.maxConnections = 100; // Max concurrent connections total

    app.use((req: Request, res: Response, next: NextFunction) =>
      connectionLimiter.use(req, res, next)
    );

    const protocol = false ? "https" : "http"; // httpsOptions ? "https" : "http";
    logger.info(`🚀 Server running on ${protocol}://${host}:${port}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
    // logger.info(`🔒 HTTPS: ${httpsOptions ? "enabled" : "disabled"}`);
    logger.info(
      `🛡️  CSRF: ${process.env.ENABLE_CSRF === "true" ? "enabled" : "disabled"}`
    );
    logger.info(`🌐 CORS: ${allowedOrigins ? "restricted" : "disabled"}`);

    // Setup graceful shutdown
    setupGracefulShutdown(app);

    return app;
  } catch (error) {
    logger.error("Bootstrap failed:", error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  bootstrap();
}

export default bootstrap;
