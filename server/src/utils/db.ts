import { Pool } from "pg";
import { Logger } from "@nestjs/common";
import * as dotenv from "dotenv";

dotenv.config();

const logger = new Logger("Postgres");

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://notif:notifpass@localhost:5432/notifications",
  max: 20, // max simultaneous connections
  min: 4, // minimum idle connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  logger.error("Unexpected PostgreSQL error on idle client", err);
  process.exit(-1);
});

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

// Retry helper
export const retryQuery = async (
  sql: string,
  params: any[] = [],
  retries = 3
): Promise<any> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await query(sql, params);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
};
