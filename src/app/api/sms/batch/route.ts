import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { ScheduledBatch, BatchEntry } from "@/types";

export async function POST(request: Request) {
  const { error, session } = await requireRole(["owner", "office_manager"]);
  if (error) return error;

  const { date, entries } = await request.json();
  if (!date || !entries || !Array.isArray(entries)) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const batchId = crypto.randomUUID();
  const batch: ScheduledBatch = {
    id: batchId,
    date,
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
