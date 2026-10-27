import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { generateToken } from "@/lib/tokens";
import { decrypt } from "@/lib/encryption";
import { sendSurveyLink } from "@/lib/telnyx";
import { logAudit } from "@/lib/audit";
import type { Client, SurveySend } from "@/types";

export async function POST(request: Request) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const { clientId, clinicianId, templateId } = await request.json();
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

  const COOLDOWN_HOURS = 24;
  const lastSendTime = await kv.get<number>(`send:cooldown:${clientId}`);
  if (lastSendTime && Date.now() - lastSendTime < COOLDOWN_HOURS * 60 * 60 * 1000) {
    return NextResponse.json({ error: "rate_limited", cooldownHours: COOLDOWN_HOURS }, { status: 429 });
  }

  const phone = decrypt(client.phone);

  const token = generateToken();
  const now = new Date();
  const expiryHours = Number(process.env.SURVEY_LINK_EXPIRY_HOURS || 48);
  const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

  const send: SurveySend = {
    id: `send:${crypto.randomUUID()}`,
    clientId,
    clinicianId,
    templateId,
    token,
    sentAt: now.toISOString(),
    sentBy: session.user.id,
    status: "pending",
    expiresAt: expiresAt.toISOString(),
  };

  const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/survey/${token}`;

  try {
    const result = await sendSurveyLink(phone, surveyUrl);
    send.status = "sent";

    const ninetyDaysSeconds = 90 * 24 * 60 * 60;
    await kv.set(`send:${send.id}`, JSON.stringify(send), { ex: ninetyDaysSeconds });
    await kv.set(`send:token:${token}`, JSON.stringify(send), { ex: ninetyDaysSeconds });

    if (result.deliveryMode === "telnyx" && result.messageId && result.messageId !== "unknown") {
      await kv.set(`sms:msgid:${result.messageId}`, send.id, { ex: ninetyDaysSeconds });
    }

    const dateKey = now.toISOString().split("T")[0];
    await kv.sadd(`send:by-date:${dateKey}`, send.id);

    await kv.set(`send:cooldown:${clientId}`, Date.now(), { ex: COOLDOWN_HOURS * 60 * 60 });

    const monthKey = now.toISOString().slice(0, 7);
    await kv.incr(`stats:sends:${monthKey}`);
    await kv.incr("stats:sends:all");

    await logAudit({
      action: "survey_sent",
      userId: session.user.id,
      userRole: session.user.role,
      resourceType: "survey",
      resourceId: send.id,
      metadata: { clientId, clinicianId, messageId: result.messageId, deliveryMode: result.deliveryMode },
    });

    // In manual delivery mode the link is handed back to the sender so it can
    // be delivered by hand. The URL carries only an opaque token — no PHI.
    if (result.deliveryMode === "manual") {
      return NextResponse.json({ success: true, sendId: send.id, token, deliveryMode: "manual", surveyUrl });
    }

    return NextResponse.json({ success: true, sendId: send.id, token, deliveryMode: "telnyx" });
  } catch (err: unknown) {
    send.status = "failed";
    await kv.set(`send:${send.id}`, JSON.stringify(send), { ex: 90 * 24 * 60 * 60 });
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "sms_failed", detail }, { status: 500 });
  }
}
