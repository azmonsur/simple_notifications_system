"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptDestination = encryptDestination;
exports.decryptDestination = decryptDestination;
exports.hashDestination = hashDestination;
var crypto = require("crypto");
var dotenv = require("dotenv");
dotenv.config();
var keyB64 = process.env.ENCRYPTION_KEY_BASE64;
var KEY = keyB64 ? Buffer.from(keyB64, "base64") : null;
/**
 * Encrypt destination using AES-256-GCM
 * Output format: base64( IV | TAG | ENCRYPTED )
 */
function encryptDestination(plain) {
    if (!KEY)
        return Buffer.from(plain || "").toString("base64");
    var iv = crypto.randomBytes(12); // 96-bit IV
    var cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
    var encrypted = Buffer.concat([
        cipher.update(plain || "", "utf8"),
        cipher.final(),
    ]);
    var tag = cipher.getAuthTag();
    // Combine → base64: IV (12 bytes) | TAG (16 bytes) | ENCRYPTED
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
/**
 * Decrypt destination encrypted with encryptDestination()
 */
function decryptDestination(encoded) {
    try {
        if (!KEY) {
            // No encryption key → assume fallback base64
            return Buffer.from(encoded, "base64").toString("utf8");
        }
        var data = Buffer.from(encoded, "base64");
        // iv: first 12 bytes
        var iv = data.subarray(0, 12);
        // tag: next 16 bytes
        var tag = data.subarray(12, 28);
        // encrypted data: remaining bytes
        var encrypted = data.subarray(28);
        var decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
        decipher.setAuthTag(tag);
        var decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ]);
        return decrypted.toString("utf8");
    }
    catch (_a) {
        // If corrupted, return original string so system doesn’t crash
        return encoded;
    }
}
/**
 * SHA-256 hash of destination for uniqueness checks
 */
function hashDestination(plain) {
    return crypto
        .createHash("sha256")
        .update(plain || "")
        .digest("hex");
}
