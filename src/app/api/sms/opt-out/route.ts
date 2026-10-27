import { NextResponse } from "next/server";
import { readTelnyxWebhook } from "@/lib/telnyx-webhook";
import { handleInboundSms } from "@/lib/inbound-sms";

/** Telnyx inbound SMS (`message.received`) → STOP/START handling. */
type InboundEvent = {
  data?: {
    event_type?: string;
    payload?: { from?: { phone_number?: string }; text?: string };
  };
};

export async function POST(request: Request) {
  const verified = await readTelnyxWebhook<InboundEvent>(request);
  if (!verified.ok) return verified.response;

  const event = verified.body?.data;
  if (!event) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (event.event_type && event.event_type !== "message.received") {
    return NextResponse.json({ received: true });
  }

  await handleInboundSms(event.payload?.from?.phone_number, event.payload?.text);
  return NextResponse.json({ received: true });
}
