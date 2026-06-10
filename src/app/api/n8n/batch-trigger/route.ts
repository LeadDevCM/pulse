import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { generateToken } from "@/lib/tokens";
import { decrypt } from "@/lib/encryption";
import { sendSurveyLink } from "@/lib/telnyx";
import { logAudit } from "@/lib/audit";
import type { ScheduledBatch, Client, SurveySend } from "@/types";

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { batchId, entryIndex } = await request.json();
  const raw = await kv.get<string>(`batch:${batchId}`);
  if (!raw) {
    return NextResponse.json({ error: "batch_not_found" }, { status: 404 });
  }

  const batch: ScheduledBatch = typeof raw === "string" ? JSON.parse(raw) : raw;
  const entry = batch.entries[entryIndex];
  if (!entry) {
    return NextResponse.json({ error: "entry_not_found" }, { status: 404 });
  }

  const rawClient = await kv.get<string>(`client:${entry.clientId}`);
  if (!rawClient) {
    batch.entries[entryIndex].status = "failed";
    await kv.set(`batch:${batchId}`, JSON.stringify(batch));
    return NextResponse.json({ error: "client_not_found" }, { status: 404 });
  }

  const client: Client = typeof rawClient === "string" ? JSON.parse(rawClient) : rawClient;
  const phone = decrypt(client.phone);
  const token = generateToken();
  const now = new Date();
  const expiryHours = Number(process.env.SURVEY_LINK_EXPIRY_HOURS || 48);
  const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

  // Get active template
  const templateIds = await kv.smembers("survey:template:index");
  let templateId = "";
  for (const tid of templateIds) {
    const tRaw = await kv.get<string>(`survey:template:${tid}`);
    if (tRaw) {
      const t = typeof tRaw === "string" ? JSON.parse(tRaw) : tRaw;
      if (t.active) { templateId = t.id; break; }
    }
  }

  if (!templateId) {
    return NextResponse.json({ error: "no_active_template" }, { status: 500 });
  }

  const send: SurveySend = {
    id: `send:${crypto.randomUUID()}`,
    clientId: entry.clientId,
    clinicianId: entry.clinicianId,
    templateId,
    token,
    sentAt: now.toISOString(),
    sentBy: batch.scheduledBy,
    status: "pending",
    expiresAt: expiresAt.toISOString(),
  };

  const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/survey/${token}`;

  try {
    await sendSurveyLink(phone, surveyUrl);
    send.status = "sent";
    batch.entries[entryIndex].status = "sent";
    batch.entries[entryIndex].sendId = send.id;
  } catch {
    send.status = "failed";
    batch.entries[entryIndex].status = "failed";
  }

  const ninetyDaysSeconds = 90 * 24 * 60 * 60;
  await kv.set(`send:${send.id}`, JSON.stringify(send), { ex: ninetyDaysSeconds });
  await kv.set(`send:token:${token}`, JSON.stringify(send), { ex: ninetyDaysSeconds });
  await kv.set(`batch:${batchId}`, JSON.stringify(batch));

  const dateKey = now.toISOString().split("T")[0];
  await kv.sadd(`send:by-date:${dateKey}`, send.id);

  await logAudit({
    action: "survey_sent",
    userId: batch.scheduledBy,
    userRole: "system",
    resourceType: "survey",
    resourceId: send.id,
    metadata: { batchId, entryIndex: String(entryIndex) },
  });

  return NextResponse.json({ success: true, sendId: send.id });
}
