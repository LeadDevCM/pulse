/**
 * SMS delivery dispatcher.
 *
 * SMS_DELIVERY_MODE selects the provider:
 *  - "sendblue": iMessage/SMS via Sendblue (dedicated line on the AI Agent plan).
 *  - "telnyx":   toll-free SMS via Telnyx (HIPAA tier, BAA). Default.
 */
import { sendViaTelnyx } from "@/lib/telnyx";
import { sendViaSendblue } from "@/lib/sendblue";

export type DeliveryMode = "telnyx" | "sendblue";

export function getDeliveryMode(): DeliveryMode {
  return process.env.SMS_DELIVERY_MODE === "sendblue" ? "sendblue" : "telnyx";
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
export async function sendText(toPhone: string, text: string): Promise<SendResult> {
  const mode = getDeliveryMode();
  const r = mode === "sendblue" ? await sendViaSendblue(toPhone, text) : await sendViaTelnyx(toPhone, text);
  return { ...r, deliveryMode: mode };
}

export async function sendSurveyLink(toPhone: string, surveyUrl: string): Promise<SendResult> {
  return sendText(toPhone, SURVEY_SMS_TEXT(surveyUrl));
}
