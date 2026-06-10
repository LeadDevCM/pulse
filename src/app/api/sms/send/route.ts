import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireRole } from "@/lib/auth-guard";
import { generateToken } from "@/lib/tokens";
import { decrypt } from "@/lib/encryption";
import { sendSurveyLink } from "@/lib/telnyx";
import { logAudit } from "@/lib/audit";
import type { Client, SurveySend } from "@/types";

export async function POST(request: Request) {
  const { error, session } = await requireRole(["owner", "office_manager"]);
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

    const dateKey = now.toISOString().split("T")[0];
    await kv.sadd(`send:by-date:${dateKey}`, send.id);

    await logAudit({
      action: "survey_sent",
      userId: session.user.id,
      userRole: session.user.role,
      resourceType: "survey",
      resourceId: send.id,
      metadata: { clientId, clinicianId, messageId: result.messageId },
    });

    return NextResponse.json({ success: true, sendId: send.id, token });
  } catch (err) {
    send.status = "failed";
    await kv.set(`send:${send.id}`, JSON.stringify(send));
    return NextResponse.json({ error: "sms_failed" }, { status: 500 });
  }
}
