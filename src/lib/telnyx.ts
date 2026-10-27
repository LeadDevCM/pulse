import Telnyx from "telnyx";

/**
 * SMS delivery mode.
 *  - "telnyx" (default): send the survey link via Telnyx.
 *  - "manual": skip the carrier. The send is still recorded and the survey
 *    URL is returned to the sender so it can be delivered by hand (copy/QR).
 *    Used while the toll-free number is pending verification and for demos.
 */
export type DeliveryMode = "telnyx" | "manual";

export function getDeliveryMode(): DeliveryMode {
  return process.env.SMS_DELIVERY_MODE === "manual" ? "manual" : "telnyx";
}

let client: Telnyx | null = null;
function getTelnyx(): Telnyx {
  if (!client) {
    if (!process.env.TELNYX_API_KEY) {
      throw new Error("TELNYX_API_KEY is not configured");
    }
    client = new Telnyx({ apiKey: process.env.TELNYX_API_KEY });
  }
  return client;
}

export const SURVEY_SMS_TEXT = (surveyUrl: string) =>
  `Mending Minds values your feedback. Please take a moment to share your experience: ${surveyUrl}`;

export async function sendSurveyLink(
  toPhone: string,
  surveyUrl: string
): Promise<{ messageId: string; status: string; deliveryMode: DeliveryMode }> {
  if (getDeliveryMode() === "manual") {
    return { messageId: "manual", status: "manual", deliveryMode: "manual" };
  }

  const message = await getTelnyx().messages.send({
    from: process.env.TELNYX_FROM_NUMBER!,
    to: toPhone,
    text: SURVEY_SMS_TEXT(surveyUrl),
    messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID!,
  });

  return {
    messageId: message.data?.id ?? "unknown",
    status: message.data?.to?.[0]?.status ?? "queued",
    deliveryMode: "telnyx",
  };
}
