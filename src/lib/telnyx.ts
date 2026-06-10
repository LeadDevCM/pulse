import Telnyx from "telnyx";

const telnyx = new Telnyx({ apiKey: process.env.TELNYX_API_KEY! });

export async function sendSurveyLink(
  toPhone: string,
  surveyUrl: string
): Promise<{ messageId: string; status: string }> {
  const message = await telnyx.messages.send({
    from: process.env.TELNYX_FROM_NUMBER!,
    to: toPhone,
    text: `Mending Minds values your feedback. Please take a moment to share your experience: ${surveyUrl}`,
    messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID!,
  });

  return {
    messageId: message.data?.id ?? "unknown",
    status: message.data?.to?.[0]?.status ?? "queued",
  };
}
