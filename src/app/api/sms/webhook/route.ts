import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function POST(request: Request) {
  const body = await request.json();

  const event = body?.data;
  if (!event) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const eventType = event.event_type;
  const messageId = event.payload?.id;

  if (!messageId) {
    return NextResponse.json({ received: true });
  }

  // Map Telnyx events to our status
  let newStatus: string | null = null;
  if (eventType === "message.sent" || eventType === "message.finalized") {
    const deliveryStatus = event.payload?.to?.[0]?.status;
    if (deliveryStatus === "delivered") {
      newStatus = "delivered";
    } else if (deliveryStatus === "sending_failed" || deliveryStatus === "delivery_failed") {
      newStatus = "failed";
    }
  }

  // We'd need to look up the send by messageId — for now just acknowledge
  // In production, store messageId -> sendId mapping at send time

  return NextResponse.json({ received: true });
}
