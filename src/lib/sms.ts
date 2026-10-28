/**
 * SMS delivery dispatcher.
 *
 * SMS_DELIVERY_MODE selects the provider:
 *  - "sendblue": iMessage/SMS via Sendblue (dedicated line on the AI Agent plan).
 *  - "webhook":  POST to SMS_WEBHOOK_URL (e.g. a Zapier catch hook that sends the text).
 *  - "telnyx":   toll-free SMS via Telnyx (HIPAA tier, BAA). Default.
 */
import { sendViaTelnyx } from "@/lib/telnyx";
import { sendViaSendblue } from "@/lib/sendblue";
import { sendViaWebhook } from "@/lib/webhook-sms";

export type DeliveryMode = "telnyx" | "sendblue" | "webhook";

export function getDeliveryMode(): DeliveryMode {
  const m = process.env.SMS_DELIVERY_MODE;
  return m === "sendblue" || m === "webhook" ? m : "telnyx";
}

export const SURVEY_SMS_TEXT = (surveyUrl: string) =>
  `Mending Minds values your feedback. Please take a moment to share your experience: ${surveyUrl}`;

export interface SendResult {
  /** Provider message id, used to correlate status webhooks. */
  messageId: string;
  status: string;
  deliveryMode: DeliveryMode;
}

/** Send an arbitrary text through the configured provider. */
export async function sendText(toPhone: string, text: string, extra: { surveyUrl?: string } = {}): Promise<SendResult> {
  const mode = getDeliveryMode();
  const r =
    mode === "sendblue" ? await sendViaSendblue(toPhone, text)
    : mode === "webhook" ? await sendViaWebhook(toPhone, text, extra)
    : await sendViaTelnyx(toPhone, text);
  return { ...r, deliveryMode: mode };
}

export async function sendSurveyLink(toPhone: string, surveyUrl: string): Promise<SendResult> {
  return sendText(toPhone, SURVEY_SMS_TEXT(surveyUrl), { surveyUrl });
}
