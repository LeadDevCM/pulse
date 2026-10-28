/**
 * Generic outbound webhook provider (e.g. a Zapier "Catch Hook" that fans
 * out to an SMS step). Pulse POSTs one JSON object per message:
 *
 *   { "to": "+14355551234", "text": "...", "survey_url": "https://...", "message_id": "..." }
 *
 * Env:
 *  SMS_WEBHOOK_URL    — the catch-hook URL
 *  SMS_WEBHOOK_SECRET — optional; sent as X-Pulse-Secret so the Zap can filter
 *                       out anything that isn't from Pulse
 *
 * There are no delivery callbacks on this path; a send is marked "sent" once
 * the webhook accepts it (2xx).
 */
export async function sendViaWebhook(
  toPhone: string,
  text: string,
  extra: { surveyUrl?: string } = {}
): Promise<{ messageId: string; status: string }> {
  const url = process.env.SMS_WEBHOOK_URL;
  if (!url) throw new Error("SMS_WEBHOOK_URL is not configured");

  const messageId = crypto.randomUUID();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.SMS_WEBHOOK_SECRET) headers["X-Pulse-Secret"] = process.env.SMS_WEBHOOK_SECRET;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: toPhone,
      text,
      survey_url: extra.surveyUrl ?? null,
      message_id: messageId,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Webhook SMS: HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }

  return { messageId, status: "accepted" };
}
