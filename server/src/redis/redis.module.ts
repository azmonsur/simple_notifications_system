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
            ? (process.env.REDIS_URL_PROD as string)
            : (process.env.REDIS_URL_DEV as string);

        if (url) {
          const client = new Redis(url);

          client.on("error", (e: any) => logger.error("Redis audit error", e));

          client
            .ping()
            .then((res) => logger.info(`Redis connected: ${res}`))
            .catch((err) => logger.error("Redis connection failed", err));

          return client;
        } else {
          logger.warn("No REDIS_URL configured — using local audit logs only");
        }
      },
    },
  ],
  exports: ["REDIS_CLIENT"],
})
export class RedisModule {}
