import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { dispatchSurvey } from "@/lib/survey-dispatch";
import type { ScheduledBatch, Client } from "@/types";

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

  if (client.optedOut) {
    batch.entries[entryIndex].status = "failed";
    await kv.set(`batch:${batchId}`, JSON.stringify(batch));
    return NextResponse.json({ error: "client_opted_out" }, { status: 422 });
  }

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

  let result;
  try {
    result = await dispatchSurvey({
      clientId: entry.clientId,
      client,
      clinicianId: entry.clinicianId,
      templateId,
      sentBy: batch.scheduledBy,
      sentByRole: "system",
    });
  } catch {
    result = null;
  }

  if (!result || result.kind === "failed") {
    batch.entries[entryIndex].status = "failed";
  } else if (result.kind === "consent_requested") {
    batch.entries[entryIndex].status = "consent_pending";
  } else {
    batch.entries[entryIndex].status = "sent";
    batch.entries[entryIndex].sendId = result.send.id;
  }
  await kv.set(`batch:${batchId}`, JSON.stringify(batch));

  return NextResponse.json({
    success: true,
    status: batch.entries[entryIndex].status,
    sendId: result && result.kind === "sent" ? result.send.id : undefined,
  });
}
