import * as crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

const keyB64 = process.env.ENCRYPTION_KEY_BASE64 || "";
const KEY = keyB64 ? Buffer.from(keyB64, "base64") : null;

export function encryptDestination(plain: string) {
  if (!KEY) return Buffer.from(plain || "").toString("base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain || "", "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function hashDestination(plain: string) {
  return crypto
    .createHash("sha256")
    .update(plain || "")
    .digest("hex");
}
