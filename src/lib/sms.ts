/**
 * SMS delivery dispatcher.
 *
 * SMS_DELIVERY_MODE selects the provider:
 *  - "twilio":   toll-free SMS via Twilio Programmable Messaging (HIPAA-eligible, BAA). Default.
 *  - "telnyx":   toll-free SMS via Telnyx (HIPAA tier, BAA).
 *  - "sendblue": iMessage/SMS via Sendblue.
 *  - "webhook":  POST to SMS_WEBHOOK_URL (e.g. a Zapier catch hook that sends the text).
 */
import { sendViaTwilio } from "@/lib/twilio";
import { sendViaTelnyx } from "@/lib/telnyx";
import { sendViaSendblue } from "@/lib/sendblue";
import { sendViaWebhook } from "@/lib/webhook-sms";

export type DeliveryMode = "twilio" | "telnyx" | "sendblue" | "webhook";

export function getDeliveryMode(): DeliveryMode {
  const m = process.env.SMS_DELIVERY_MODE;
  return m === "telnyx" || m === "sendblue" || m === "webhook" ? m : "twilio";
}

export const SURVEY_SMS_TEXT = (surveyUrl: string) =>
  `Hi! Thank you for trusting us with your care. We'd love to hear how your session went — your honest feedback helps us take better care of you: ${surveyUrl} Reply STOP to opt out.`;

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
    mode === "telnyx" ? await sendViaTelnyx(toPhone, text)
    : mode === "sendblue" ? await sendViaSendblue(toPhone, text)
    : mode === "webhook" ? await sendViaWebhook(toPhone, text, extra)
    : await sendViaTwilio(toPhone, text);
  return { ...r, deliveryMode: mode };
}

export async function sendSurveyLink(toPhone: string, surveyUrl: string): Promise<SendResult> {
  return sendText(toPhone, SURVEY_SMS_TEXT(surveyUrl), { surveyUrl });
}
