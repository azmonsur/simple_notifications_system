import * as crypto from "crypto";

export function verifySignature(
  secret: string,
  rawBody: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return expected === signature;
}
