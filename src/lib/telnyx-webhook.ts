import crypto from "crypto";
import { NextResponse } from "next/server";

/**
 * Verifies a Telnyx webhook (Ed25519).
 *
 * Telnyx signs `${timestamp}|${rawBody}` with its account-level Ed25519 key and
 * sends the signature in `telnyx-signature-ed25519` and the timestamp in
 * `telnyx-timestamp`. The public key is shown in the Telnyx portal under
 * Account Settings → Keys & Credentials → Public Key, and goes in
 * TELNYX_PUBLIC_KEY (base64, 32 bytes raw).
 *
 * Without this check anyone who learns the webhook URL could, for example,
 * opt every client out by posting "STOP".
 */

const TOLERANCE_SECONDS = 5 * 60;
// DER prefix for an Ed25519 SubjectPublicKeyInfo wrapping a raw 32-byte key.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

let publicKey: crypto.KeyObject | null = null;
function getPublicKey(): crypto.KeyObject | null {
  if (publicKey) return publicKey;
  const raw = process.env.TELNYX_PUBLIC_KEY;
  if (!raw) return null;
  const der = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(raw.trim(), "base64")]);
  publicKey = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
  return publicKey;
}

export type VerifiedWebhook<T = unknown> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse };

/**
 * Reads the raw request body, verifies the Telnyx signature, and parses JSON.
 * Returns a ready-made error response on failure so routes stay short.
 */
export async function readTelnyxWebhook<T = unknown>(request: Request): Promise<VerifiedWebhook<T>> {
  const key = getPublicKey();
  if (!key) {
    console.error("TELNYX_PUBLIC_KEY is not configured; rejecting webhook");
    return { ok: false, response: NextResponse.json({ error: "webhook_not_configured" }, { status: 503 }) };
  }

  const signature = request.headers.get("telnyx-signature-ed25519");
  const timestamp = request.headers.get("telnyx-timestamp");
  if (!signature || !timestamp) {
    return { ok: false, response: NextResponse.json({ error: "missing_signature" }, { status: 401 }) };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_SECONDS) {
    return { ok: false, response: NextResponse.json({ error: "stale_timestamp" }, { status: 401 }) };
  }

  const rawBody = await request.text();
  const signed = Buffer.from(`${timestamp}|${rawBody}`);

  let valid = false;
  try {
    valid = crypto.verify(null, signed, key, Buffer.from(signature, "base64"));
  } catch {
    valid = false;
  }
  if (!valid) {
    return { ok: false, response: NextResponse.json({ error: "invalid_signature" }, { status: 401 }) };
  }

  try {
    return { ok: true, body: JSON.parse(rawBody) as T };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "invalid_payload" }, { status: 400 }) };
  }
}
