import Telnyx from "telnyx";

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

export async function sendViaTelnyx(
  toPhone: string,
  text: string
): Promise<{ messageId: string; status: string }> {
  const message = await getTelnyx().messages.send({
    from: process.env.TELNYX_FROM_NUMBER!,
    to: toPhone,
    text,
    messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID!,
  });

  return {
    messageId: message.data?.id ?? "unknown",
    status: message.data?.to?.[0]?.status ?? "queued",
  };
}
