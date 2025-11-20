import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

const keyB64 = process.env.ENCRYPTION_KEY_BASE64;
const KEY = keyB64 ? Buffer.from(keyB64, "base64") : null;

/**
 * Encrypt destination using AES-256-GCM
 * Output format: base64( IV | TAG | ENCRYPTED )
 */
export function encryptDestination(plain: string) {
  if (!KEY) return Buffer.from(plain || "").toString("base64");

  const iv = crypto.randomBytes(12); // 96-bit IV
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plain || "", "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Combine → base64: IV (12 bytes) | TAG (16 bytes) | ENCRYPTED
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt destination encrypted with encryptDestination()
 */
export function decryptDestination(encoded: string): string {
  try {
    if (!KEY) {
      // No encryption key → assume fallback base64
      return Buffer.from(encoded, "base64").toString("utf8");
    }

    const data = Buffer.from(encoded, "base64");

    // iv: first 12 bytes
    const iv = data.subarray(0, 12);

    // tag: next 16 bytes
    const tag = data.subarray(12, 28);

    // encrypted data: remaining bytes
    const encrypted = data.subarray(28);

    const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    // If corrupted, return original string so system doesn’t crash
    return encoded;
  }
}

/**
 * SHA-256 hash of destination for uniqueness checks
 */
export function hashDestination(plain: string) {
  return crypto
    .createHash("sha256")
    .update(plain || "")
    .digest("hex");
}
