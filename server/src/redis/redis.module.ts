import { Module, Global } from "@nestjs/common";
import { logger } from "../utils/logger/logger";
import Redis from "ioredis";

@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CLIENT",
      useFactory: () => {
        const url =
          process.env.NODE_ENV === "production"
            ? process.env.REDIS_URL_PROD
            : process.env.REDIS_URL_DEV;

        if (!url) {
          logger.warn("No REDIS_URL configured — using local audit logs only");
          throw new Error("REDIS_URL not set");
        }

        const client = new Redis(url);

        client.on("error", (e) => logger.error("Redis audit error", e));

        client
          .ping()
          .then((res) => logger.info(`Redis connected: ${res}`))
          .catch((err) => logger.error("Redis connection failed", err));

        return client;
      },
    },
  ],
  exports: ["REDIS_CLIENT"],
})
export class RedisModule {}
