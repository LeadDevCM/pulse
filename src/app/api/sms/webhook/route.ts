import { NextResponse } from "next/server";
import { readTelnyxWebhook } from "@/lib/telnyx-webhook";
import { updateSendStatus } from "@/lib/send-status";

type TelnyxEvent = { data?: { event_type?: string; payload?: { id?: string; to?: { status?: string }[] } } };

export async function POST(request: Request) {
  const verified = await readTelnyxWebhook<TelnyxEvent>(request);
  if (!verified.ok) return verified.response;

  const event = verified.body?.data;
  if (!event) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const eventType = event.event_type;
  const messageId = event.payload?.id;
  if (!messageId) {
    return NextResponse.json({ received: true });
  }

  let newStatus: "delivered" | "failed" | null = null;
  if (eventType === "message.sent" || eventType === "message.finalized") {
    const deliveryStatus = event.payload?.to?.[0]?.status;
    if (deliveryStatus === "delivered") {
      newStatus = "delivered";
    } else if (deliveryStatus === "sending_failed" || deliveryStatus === "delivery_failed") {
      newStatus = "failed";
    }
  }

  if (newStatus) await updateSendStatus(messageId, newStatus);
  return NextResponse.json({ received: true });
}
