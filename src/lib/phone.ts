import crypto from "crypto";

/**
 * Normalize a raw phone string to E.164 format (+1XXXXXXXXXX).
 * Handles formats like:
 *   435.592.6407
 *   (435) 704-8987
 *   435) 590-6429  (missing opening paren)
 *   +1 702-308-2041
 * Returns null if the input cannot produce a valid 10-digit US number.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  // Strip everything except digits and leading +
  const digits = raw.replace(/[^\d]/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
}

/**
 * Keyed one-way hash of an E.164 phone number, used as a lookup index
 * (`client:phone:{hash}` -> clientId) so inbound SMS can be matched to a
 * client without decrypting every record. HMAC with the encryption key means
 * the index is useless without the key; the plaintext number is never stored.
 */
export function phoneHash(e164: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  return crypto.createHmac("sha256", key).update(`phone:${e164}`).digest("hex");
}

export const phoneIndexKey = (e164: string) => `client:phone:${phoneHash(e164)}`;
