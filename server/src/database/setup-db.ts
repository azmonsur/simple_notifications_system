import { readFileSync } from "fs";
import { join } from "path";
import { query, retryQuery } from "../utils/db";
import { logger } from "../utils/logger";
import * as dotenv from "dotenv";

dotenv.config();

const isDev = process.env.NODE_ENV === "development";
const devUser = "notif";

export const setup = async () => {
  try {
    logger.info("[DB-Setup] Reading schema SQL file...");
    const schemaPath = join(__dirname, "migrations", "schema.sql");
    const fullSchema = readFileSync(schemaPath, "utf-8");

    const statements = fullSchema
      .split(/;\s*$/gm)
      .map((stmt) => stmt.trim())
      .filter(Boolean);

    logger.info(
      `[DB-Setup] Split schema into ${statements.length} statement(s). Running sequentially...`
    );

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      logger.info(
        `[DB-Setup] Running statement ${i + 1}/${
          statements.length
        } (first 80 chars): ${stmt.slice(0, 80)}...`
      );

      try {
        // Detect table name for CREATE TABLE statements
        let tableName: string | null = null;
        const createTableMatch = stmt.match(
          /CREATE TABLE IF NOT EXISTS (\w+)/i
        );
        if (createTableMatch) tableName = createTableMatch[1];

        // Check if table already exists
        let isNewTable = true;
        if (tableName) {
          const existsRes = await query(`SELECT to_regclass($1) AS exists;`, [
            tableName,
          ]);
          isNewTable = !existsRes.rows[0]?.exists;
        }

        await retryQuery(stmt);

        // If new table and in development, grant ownership/privileges
        if (isDev && tableName && isNewTable) {
          const grantSql = `
            ALTER TABLE ${tableName} OWNER TO ${devUser};
            GRANT ALL PRIVILEGES ON TABLE ${tableName} TO ${devUser};
          `;
          await retryQuery(grantSql);
          logger.info(
            `[DB-Setup] Granted ownership and privileges on ${tableName} to ${devUser}`
          );
        }
      } catch (err: any) {
        if (isDev && err.code === "42501") {
          logger.warn(
            `[DB-Setup] Permission error on statement ${i + 1}, skipping: ${
              err.message
            }`
          );
          continue;
        }
        throw err;
      }
    }

    logger.info("[DB-Setup] Database schema setup completed successfully!");
  } catch (err) {
    logger.error("[DB-Setup] Fatal error setting up DB:", err);
    process.exit(1);
  }
};

// Uncomment to run standalone
// if (require.main === module) {
//   setup();
// }
