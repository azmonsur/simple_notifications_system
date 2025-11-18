import { Pool } from "pg";
import { Logger } from "@nestjs/common";
import * as dotenv from "dotenv";

dotenv.config();

const logger = new Logger("Postgres");

export const pool = new Pool({
  user: "postgres.hyuvqjcbwdsbemnnbomn",
  password: "Omotayo_sql0308",
  host: "aws-1-eu-north-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  max: 20,
  idleTimeoutMillis: 30000, // close idle clients after 30s
  connectionTimeoutMillis: 5000, // fail fast if cannot connect
});

// 🔹 Handle idle client errors gracefully
pool.on("error", (err) => {
  logger.error("Unexpected Postgres error on idle client", err);
  // Do NOT exit the process
});

// 🔹 Basic query function with timing
export const query = async (sql: string, params?: any[]) => {
  const start = Date.now();
  try {
    const result = await pool.query(sql, params);
    const duration = Date.now() - start;
    logger.log(`Query executed in ${duration}ms, rows: ${result.rowCount}`);
    return result;
  } catch (err: any) {
    logger.error(`DB Query Error: ${err.message}`, err.stack);
    throw err;
  }
};

// 🔹 Retry helper for transient errors
export const retryQuery = async (
  sql: string,
  params: any[] = [],
  retries = 3,
  delayMs = 200
) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await query(sql, params);
    } catch (err: any) {
      const retriableErrors = [
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNREFUSED",
        "EPIPE",
        "ENETDOWN",
        "Connection terminated unexpectedly",
      ];

      // Only retry if it's a transient/network error
      if (
        attempt < retries &&
        (retriableErrors.some((e) => err.message.includes(e)) ||
          err.code === "57P01") // admin shutdown
      ) {
        logger.warn(
          `Transient DB error, retrying attempt ${attempt} in ${
            delayMs * attempt
          }ms...`
        );
        await new Promise((r) => setTimeout(r, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
};

// 🔹 Optional: graceful shutdown
export const closePool = async () => {
  try {
    await pool.end();
    logger.log("Postgres pool closed.");
  } catch (err) {
    logger.error("Error closing Postgres pool:", err);
  }
};
