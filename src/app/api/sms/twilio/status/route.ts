import { NextResponse } from "next/server";
import { readTwilioWebhook } from "@/lib/twilio";
import { updateSendStatus } from "@/lib/send-status";

/** Twilio message status callback (MessageSid, MessageStatus, ErrorCode). */
export async function POST(request: Request) {
  const params = await readTwilioWebhook(request);
  if (!params) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  const sid = params.MessageSid || params.SmsSid;
  const status = (params.MessageStatus || params.SmsStatus || "").toLowerCase();
  if (sid) {
    if (status === "delivered") await updateSendStatus(sid, "delivered");
    else if (status === "failed" || status === "undelivered") await updateSendStatus(sid, "failed");
  }
  return new NextResponse("", { status: 204 });
}
