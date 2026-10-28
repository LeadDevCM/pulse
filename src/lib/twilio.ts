/**
 * Twilio Programmable Messaging provider (plain REST, no SDK).
 *
 * Env:
 *  TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
 *  TWILIO_FROM_NUMBER            — the toll-free number in E.164, or
 *  TWILIO_MESSAGING_SERVICE_SID  — a Messaging Service SID (preferred once set up)
 *
 * Status callbacks go to /api/sms/twilio/status; inbound messages to
 * /api/sms/twilio/inbound (set that as the number's "A message comes in"
 * webhook in the Twilio console). Both validate X-Twilio-Signature.
 */
import crypto from "crypto";

function creds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error("TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN are not configured");
  return { sid, token };
}

export function twilioStatusCallbackUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return base ? `${base}/api/sms/twilio/status` : undefined;
}

export async function sendViaTwilio(
  toPhone: string,
  text: string
): Promise<{ messageId: string; status: string }> {
  const { sid, token } = creds();
  const form = new URLSearchParams({ To: toPhone, Body: text });

  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    form.set("MessagingServiceSid", process.env.TWILIO_MESSAGING_SERVICE_SID);
  } else if (process.env.TWILIO_FROM_NUMBER) {
    form.set("From", process.env.TWILIO_FROM_NUMBER);
  } else {
    throw new Error("Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID");
  }
  const cb = twilioStatusCallbackUrl();
  if (cb) form.set("StatusCallback", cb);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const json = (await res.json().catch(() => ({}))) as {
    sid?: string; status?: string; code?: number; message?: string;
  };

  if (!res.ok) {
    throw new Error(`Twilio${json.code ? ` ${json.code}` : ""}: ${json.message || `HTTP ${res.status}`}`);
  }

  return { messageId: json.sid ?? "unknown", status: json.status ?? "queued" };
}

/**
 * Validates X-Twilio-Signature: base64(HMAC-SHA1(authToken, url + concat of
 * POST params sorted by key, as key+value)). `url` must be the exact public
 * URL Twilio called, including query string.
 */
export function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature) return false;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = crypto.createHmac("sha1", token).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Reads a Twilio form-encoded webhook, validating the signature. */
export async function readTwilioWebhook(request: Request): Promise<Record<string, string> | null> {
  const raw = await request.text();
  const params: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(raw)) params[k] = v;

  // Reconstruct the public URL Twilio signed (behind Vercel's proxy the
  // request.url host is the deployment host, so prefer NEXT_PUBLIC_APP_URL).
  const incoming = new URL(request.url);
  const base = process.env.NEXT_PUBLIC_APP_URL;
  const publicUrl = base ? `${base.replace(/\/$/, "")}${incoming.pathname}${incoming.search}` : request.url;

  const sig = request.headers.get("x-twilio-signature");
  if (verifyTwilioSignature(publicUrl, params, sig)) return params;
  // Some proxies alter the scheme/host; try the raw request URL as a fallback.
  if (publicUrl !== request.url && verifyTwilioSignature(request.url, params, sig)) return params;
  return null;
}
