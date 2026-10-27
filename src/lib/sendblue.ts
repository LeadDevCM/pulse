/**
 * Sendblue (iMessage / SMS) provider. Docs: https://docs.sendblue.com/api-v2
 *
 * Env:
 *  SENDBLUE_API_KEY_ID, SENDBLUE_API_SECRET_KEY — from Developer → API Keys
 *  SENDBLUE_FROM_NUMBER — your Sendblue line in E.164 (required on the free
 *                         shared-line plan; optional on dedicated lines)
 *  SENDBLUE_WEBHOOK_SECRET — shared secret for our status/inbound webhook
 */

const BASE_URL = "https://api.sendblue.com";

function headers(): Record<string, string> {
  const id = process.env.SENDBLUE_API_KEY_ID;
  const secret = process.env.SENDBLUE_API_SECRET_KEY;
  if (!id || !secret) {
    throw new Error("SENDBLUE_API_KEY_ID / SENDBLUE_API_SECRET_KEY are not configured");
  }
  return {
    "sb-api-key-id": id,
    "sb-api-secret-key": secret,
    "Content-Type": "application/json",
  };
}

/** URL Sendblue posts status updates to; carries our shared secret. */
export function sendblueWebhookUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.SENDBLUE_WEBHOOK_SECRET;
  if (!base || !secret) return undefined;
  return `${base}/api/sms/sendblue?secret=${encodeURIComponent(secret)}`;
}

interface SendblueResponse {
  status?: string;
  error_code?: number | string;
  error_key?: string;
  message?: string;
  message_handle?: string;
  from_number?: string;
  sendblue_number?: string;
  data?: { message_handle?: string; status?: string };
}

export async function sendViaSendblue(
  toPhone: string,
  text: string
): Promise<{ messageId: string; status: string }> {
  const body: Record<string, unknown> = { number: toPhone, content: text };
  if (process.env.SENDBLUE_FROM_NUMBER) body.from_number = process.env.SENDBLUE_FROM_NUMBER;
  const callback = sendblueWebhookUrl();
  if (callback) body.status_callback = callback;

  const res = await fetch(`${BASE_URL}/api/send-message`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as SendblueResponse;

  if (!res.ok || json.status === "ERROR") {
    const detail = [json.error_key, json.message].filter(Boolean).join(": ") || `HTTP ${res.status}`;
    throw new Error(`Sendblue: ${detail}`);
  }

  return {
    messageId: json.message_handle ?? json.data?.message_handle ?? "unknown",
    status: (json.status ?? json.data?.status ?? "QUEUED").toLowerCase(),
  };
}
