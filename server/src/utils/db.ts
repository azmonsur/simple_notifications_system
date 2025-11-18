import { Pool } from "pg";
import { Logger } from "@nestjs/common";
import * as dotenv from "dotenv";

dotenv.config();

const logger = new Logger("Postgres");

// export const pool = new Pool({
//   connectionString: process.env.POSTGRE_URL,
//   max: 20,
//   min: 4,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 5000,
//   // ssl: true, // required for Supabase
// });

console.log("Connecting to Postgres at:", process.env.POSTGRE_HOST);
export const pool = new Pool({
  user: "postgres.hyuvqjcbwdsbemnnbomn",
  password: `Omotayo_sql0308`,
  host: "aws-1-eu-north-1.pooler.supabase.com",
  port: 5432,
  database: "postgres",
  // pool_mode: "session",
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
) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await query(sql, params);
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
};
