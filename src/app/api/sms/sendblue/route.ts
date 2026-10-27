import { NextResponse } from "next/server";
import crypto from "crypto";
import { updateSendStatus } from "@/lib/send-status";
import { handleInboundSms } from "@/lib/inbound-sms";

/**
 * Sendblue webhook — receives both outbound status callbacks (via the
 * status_callback we pass on send) and inbound messages (configure this URL
 * under Developer → Webhooks, type "receive").
 *
 * Auth: Sendblue has no signature scheme, so the URL carries a shared secret
 * (?secret=...) which must match SENDBLUE_WEBHOOK_SECRET. A secret presented
 * in a request header is accepted too, for webhooks configured with one in
 * the Sendblue dashboard.
 */
type SendbluePayload = {
  is_outbound?: boolean;
  status?: string;
  message_handle?: string;
  number?: string;
  from_number?: string;
  content?: string;
  error_code?: number | string;
  error_key?: string;
};

function secretMatches(request: Request): boolean {
  const expected = process.env.SENDBLUE_WEBHOOK_SECRET;
  if (!expected) return false;
  const url = new URL(request.url);
  const candidates = [
    url.searchParams.get("secret"),
    request.headers.get("sb-signing-secret"),
    request.headers.get("sb-webhook-secret"),
    request.headers.get("x-sendblue-secret"),
  ].filter((v): v is string => typeof v === "string" && v.length > 0);
  const want = Buffer.from(expected);
  return candidates.some((c) => {
    const got = Buffer.from(c);
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  });
}

export async function POST(request: Request) {
  if (!process.env.SENDBLUE_WEBHOOK_SECRET) {
    console.error("SENDBLUE_WEBHOOK_SECRET is not configured; rejecting webhook");
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }
  if (!secretMatches(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as SendbluePayload | null;
  if (!payload) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  if (payload.is_outbound === false || payload.status === "RECEIVED") {
    // Inbound message from a client. `number` is the end user's number.
    await handleInboundSms(payload.number ?? payload.from_number, payload.content);
    return NextResponse.json({ received: true });
  }

  if (payload.message_handle) {
    const s = (payload.status || "").toUpperCase();
    if (s === "DELIVERED") {
      await updateSendStatus(payload.message_handle, "delivered");
    } else if (s === "ERROR" || s === "DECLINED") {
      await updateSendStatus(payload.message_handle, "failed");
    }
  }

  return NextResponse.json({ received: true });
}
