import { NextResponse } from "next/server";
import { readTwilioWebhook } from "@/lib/twilio";
import { handleInboundSms } from "@/lib/inbound-sms";

/**
 * Twilio "A message comes in" webhook. Handles STOP/START/YES. Replies with an
 * empty TwiML document so Twilio sends nothing back on its own (Twilio's
 * built-in opt-out handling still answers STOP/HELP at the carrier level).
 */
export async function POST(request: Request) {
  const params = await readTwilioWebhook(request);
  if (!params) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  await handleInboundSms(params.From, params.Body);

  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
