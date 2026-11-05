import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { ScheduledBatch, BatchEntry } from "@/types";

export async function GET() {
  const { error } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const batchIds = await kv.smembers("batch:index");
  const batches = [];

  for (const bid of batchIds) {
    const raw = await kv.get(`batch:${bid}`);
    if (!raw) continue;
    const batch: ScheduledBatch = typeof raw === "string" ? JSON.parse(raw) : raw;
    const total = batch.entries.length;
    const sent = batch.entries.filter((e) => e.status === "sent").length;
    const failed = batch.entries.filter((e) => e.status === "failed").length;
    const pending = batch.entries.filter((e) => e.status === "pending" || e.status === "consent_pending").length;
    batches.push({
      id: batch.id,
      date: batch.date,
      templateId: batch.templateId,
      createdAt: batch.createdAt,
      total,
      sent,
      failed,
      pending,
      complete: pending === 0,
    });
  }

  batches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ batches });
}

export async function POST(request: Request) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const { date, templateId, entries } = await request.json();
  if (!date || !templateId || !entries || !Array.isArray(entries)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const batchId = crypto.randomUUID();
  const batch: ScheduledBatch = {
    id: batchId,
    date,
    templateId,
    scheduledBy: session.user.id,
    entries: entries.map((e: BatchEntry) => ({
      clientId: e.clientId,
      clinicianId: e.clinicianId,
      appointmentTime: e.appointmentTime,
      sendAfterMinutes: e.sendAfterMinutes,
      status: "pending" as const,
    })),
    createdAt: new Date().toISOString(),
  };

  const ninetyDaysSeconds = 90 * 24 * 60 * 60;
  await kv.set(`batch:${batchId}`, JSON.stringify(batch), { ex: ninetyDaysSeconds });
  await kv.sadd("batch:index", batchId);

  // Notify n8n to schedule the batch sends
  if (process.env.N8N_BASE_URL) {
    try {
      await fetch(`${process.env.N8N_BASE_URL}/webhook/batch-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET!,
        },
        body: JSON.stringify({ batchId, date, entries: batch.entries }),
      });
    } catch {
      // n8n notification is best-effort
    }
  }

  await logAudit({
    action: "survey_batch_sent",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "batch",
    resourceId: batchId,
    metadata: { date, entryCount: String(entries.length) },
  });

  return NextResponse.json({ success: true, batchId });
}
