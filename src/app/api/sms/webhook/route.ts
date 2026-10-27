import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { readTelnyxWebhook } from "@/lib/telnyx-webhook";
import type { SurveySend } from "@/types";

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

  if (newStatus) {
    const sendId = await kv.get<string>(`sms:msgid:${messageId}`);
    if (sendId) {
      const raw = await kv.get<string>(`send:${sendId}`);
      if (raw) {
        const send: SurveySend = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (send.status !== "completed") {
          send.status = newStatus;
          const ninetyDaysSeconds = 90 * 24 * 60 * 60;
          await kv.set(`send:${sendId}`, JSON.stringify(send), { ex: ninetyDaysSeconds });
          await kv.set(`send:token:${send.token}`, JSON.stringify(send), { ex: ninetyDaysSeconds });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
