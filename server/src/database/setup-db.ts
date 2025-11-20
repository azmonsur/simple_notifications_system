import { readFileSync } from "fs";
import { join } from "path";
import { query, retryQuery } from "../utils/db";
import { Logger } from "@nestjs/common";
import { logger } from "../utils/logger";

export const setup = async () => {
  try {
    logger.info("[DB-Setup] Reading schema SQL file...");
    const schemaPath = join(__dirname, "migrations", "schema.sql"); // adjust if your schema file is elsewhere
    const fullSchema = readFileSync(schemaPath, "utf-8");

    // Split statements safely on semicolons that are at the end of a line
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
        await retryQuery(stmt);
      } catch (err: any) {
        logger.error(
          `[DB-Setup] Error executing statement ${i + 1}: ${err.message}`
        );
        throw err;
      }
    }

    logger.info("[DB-Setup] Database schema setup completed successfully!");
  } catch (err) {
    logger.error("[DB-Setup] Fatal error setting up DB:", err);
    process.exit(1);
  }
};

// Run setup if file is executed directly
// if (require.main === module) {
//   setup();
// }
