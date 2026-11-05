import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { dispatchSurvey } from "@/lib/survey-dispatch";
import type { Client } from "@/types";

export async function POST(request: Request) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const { clientId, clinicianId, templateId, linkOnly } = await request.json();
  if (!clientId || !clinicianId || !templateId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const rawClient = await kv.get<string>(`client:${clientId}`);
  if (!rawClient) {
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }
  const client: Client = typeof rawClient === "string" ? JSON.parse(rawClient) : rawClient;

  if (client.optedOut) {
    return NextResponse.json({ error: "client_opted_out" }, { status: 422 });
  }

  if (!client.smsApproved) {
    return NextResponse.json({ error: "sms_not_approved" }, { status: 422 });
  }

  const COOLDOWN_HOURS = 24;
  const lastSendTime = await kv.get<number>(`send:cooldown:${clientId}`);
  if (lastSendTime && Date.now() - lastSendTime < COOLDOWN_HOURS * 60 * 60 * 1000) {
    return NextResponse.json({ error: "rate_limited", cooldownHours: COOLDOWN_HOURS }, { status: 429 });
  }

  let result;
  try {
    result = await dispatchSurvey({
      clientId,
      client,
      clinicianId,
      templateId,
      sentBy: session.user.id,
      sentByRole: session.user.role,
      linkOnly: !!linkOnly,
    });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "sms_failed", detail }, { status: 500 });
  }

  if (result.kind === "consent_requested") {
    // Survey is parked until the client replies YES; the cooldown still applies
    // so the prompt isn't re-fired by repeated clicks.
    await kv.set(`send:cooldown:${clientId}`, Date.now(), { ex: COOLDOWN_HOURS * 60 * 60 });
    return NextResponse.json({ success: true, consentRequested: true, prompted: result.prompted }, { status: 202 });
  }

  if (result.kind === "failed") {
    return NextResponse.json({ error: "sms_failed", detail: result.detail }, { status: 500 });
  }

  await kv.set(`send:cooldown:${clientId}`, Date.now(), { ex: COOLDOWN_HOURS * 60 * 60 });

  if (result.kind === "link_only") {
    return NextResponse.json({ success: true, sendId: result.send.id, token: result.send.token, surveyUrl: result.surveyUrl, linkOnly: true });
  }

  return NextResponse.json({ success: true, sendId: result.send.id, token: result.send.token, deliveryMode: result.deliveryMode });
}
