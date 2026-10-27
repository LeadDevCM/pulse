/**
 * SMS delivery dispatcher.
 *
 * SMS_DELIVERY_MODE selects the provider:
 *  - "telnyx"  (default): toll-free SMS via Telnyx (HIPAA tier, BAA).
 *  - "sendblue": iMessage/SMS via Sendblue. BAA available on request;
 *                the free tier requires each recipient to be a saved contact
 *                who has texted the line first.
 *  - "manual":  skip the carrier; the survey URL is returned to the sender
 *               and shown on the send screen (copy / QR).
 */
import { sendViaTelnyx } from "@/lib/telnyx";
import { sendViaSendblue } from "@/lib/sendblue";

export type DeliveryMode = "telnyx" | "sendblue" | "manual";

export function getDeliveryMode(): DeliveryMode {
  const mode = process.env.SMS_DELIVERY_MODE;
  if (mode === "manual" || mode === "sendblue") return mode;
  return "telnyx";
}

export const SURVEY_SMS_TEXT = (surveyUrl: string) =>
  `Mending Minds values your feedback. Please take a moment to share your experience: ${surveyUrl}`;

export interface SendResult {
  /** Provider message id, used to correlate status webhooks. "manual" when skipped. */
  messageId: string;
  status: string;
  deliveryMode: DeliveryMode;
}

export async function sendSurveyLink(toPhone: string, surveyUrl: string): Promise<SendResult> {
  const mode = getDeliveryMode();
  const text = SURVEY_SMS_TEXT(surveyUrl);

  if (mode === "manual") {
    return { messageId: "manual", status: "manual", deliveryMode: "manual" };
  }
  if (mode === "sendblue") {
    const r = await sendViaSendblue(toPhone, text);
    return { ...r, deliveryMode: "sendblue" };
  }
  const r = await sendViaTelnyx(toPhone, text);
  return { ...r, deliveryMode: "telnyx" };
}
