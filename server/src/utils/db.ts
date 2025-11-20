import { Pool } from "pg";
import { Logger } from "@nestjs/common";
import * as dotenv from "dotenv";

dotenv.config();

const logger = new Logger("Postgres");

const POSTGRE_URL =
  process.env.NODE_ENV === "production"
    ? (process.env.POSTGRE_URL_PROD as string)
    : (process.env.POSTGRE_URL_DEV as string);

export const pool = new Pool({
  connectionString: POSTGRE_URL,
  max: 20,
  idleTimeoutMillis: 30000, // close idle clients after 15s
  connectionTimeoutMillis: 5000,
});

// export const pool = new Pool({
//   user: "postgres.hyuvqjcbwdsbemnnbomn",
//   password: "Omotayo_sql0308",
//   host: "aws-1-eu-north-1.pooler.supabase.com",
//   port: 5432,
//   database: "postgres",
//   max: 20,
//   idleTimeoutMillis: 30000, // close idle clients after 30s
//   connectionTimeoutMillis: 5000, // fail fast if cannot connect
// });

pool.on("error", (err) => {
  logger.error("Unexpected Postgres error on idle client", err);
});

// Keep-alive ping
setInterval(async () => {
  try {
    await pool.query("SELECT 1");
    logger.debug("Postgres keep-alive ping succeeded");
  } catch (err) {
    logger.warn("Postgres keep-alive ping failed", err);
  }
}, 250000);

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

export const retryQuery = async (
  sql: string,
  params: any[] = [],
  retries = 5,
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
        "db_termination",
        "57P01", // admin shutdown
      ];

      if (
        attempt < retries &&
        (retriableErrors.some((e) => err.message.includes(e)) ||
          retriableErrors.includes(err.code))
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

export const closePool = async () => {
  try {
    await pool.end();
    logger.log("Postgres pool closed.");
  } catch (err) {
    logger.error("Error closing Postgres pool:", err);
  }
};
