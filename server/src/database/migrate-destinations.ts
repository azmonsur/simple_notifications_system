// src/database/migrate-destinations.ts
import { query, retryQuery } from "../utils/db";
import { Logger } from "@nestjs/common";
import { encryptDestination } from "../modules/notifications/utils/crypto";
import * as dotenv from "dotenv";

dotenv.config();

const logger = new Logger("DB-Migrate");

export const migrate = async () => {
  try {
    console.log("🔄 Starting migration of recipient_destination...");

    // 1️⃣ Fetch all notifications
    const res = await query(
      "SELECT id, recipient_destination FROM notifications"
    );
    console.log(`ℹ️ Found ${res.rows.length} notifications to process.`);

    for (const row of res.rows) {
      try {
        // 2️⃣ Treat current value as plaintext and re-encrypt
        const reEncrypted = encryptDestination(row.recipient_destination);

        // 3️⃣ Update DB
        await retryQuery(
          "UPDATE notifications SET recipient_destination=$1 WHERE id=$2",
          [reEncrypted, row.id]
        );

        console.log(`✅ Updated notification ${row.id}`);
      } catch (err: any) {
        logger.error(
          `❌ Failed to update notification ${row.id}: ${err.message}`
        );
      }
    }

    console.log("🎉 Migration complete!");
  } catch (err: any) {
    logger.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
};

// Run migration if executed directly
if (require.main === module) {
  migrate();
}
