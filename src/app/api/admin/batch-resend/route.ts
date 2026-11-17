import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { ScheduledBatch } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cronAuth = request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  let userId = "system";
  let userRole = "system";

  if (!cronAuth) {
    const { error, session } = await requireRole(["partner", "office_manager"]);
    if (error) return error;
    userId = session.user.id;
    userRole = session.user.role;
  }

  const { fromDate, toDate, rescheduleDate, rescheduleTime } = await request.json();
  if (!fromDate || !toDate || !rescheduleDate || !rescheduleTime) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const start = new Date(fromDate);
  const end = new Date(toDate);
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  const allBatchIds = new Set<string>();
  for (const date of dates) {
    const ids = await kv.smembers(`batch:by-date:${date}`);
    ids.forEach((id) => allBatchIds.add(id as string));
  }

  const seen = new Set<string>();
  const entriesToResend: { clientId: string; clinicianId: string }[] = [];
  let templateId = "";
  let originalScheduledBy = "";
  const sourceBatches: string[] = [];

  for (const batchId of allBatchIds) {
    const raw = await kv.get(`batch:${batchId}`);
    if (!raw) continue;
    const batch: ScheduledBatch = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (!templateId) {
      templateId = batch.templateId;
      originalScheduledBy = batch.scheduledBy;
    }

    for (const entry of batch.entries) {
      if (entry.status === "sent") continue;
      const key = `${entry.clientId}:${entry.clinicianId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entriesToResend.push({
        clientId: entry.clientId,
        clinicianId: entry.clinicianId,
      });
    }

    if (batch.entries.some((e) => e.status !== "sent")) {
      sourceBatches.push(batchId);
    }
  }

  if (entriesToResend.length === 0) {
    return NextResponse.json({ success: true, message: "no_entries_to_resend", count: 0 });
  }

  const newBatchId = crypto.randomUUID();
  const newBatch: ScheduledBatch = {
    id: newBatchId,
    date: rescheduleDate,
    templateId,
    scheduledBy: userId,
    entries: entriesToResend.map((e) => ({
      clientId: e.clientId,
      clinicianId: e.clinicianId,
      appointmentTime: rescheduleTime,
      sendAfterMinutes: 0,
      status: "pending" as const,
    })),
    createdAt: new Date().toISOString(),
  };

  const ninetyDaysSeconds = 90 * 24 * 60 * 60;
  await kv.set(`batch:${newBatchId}`, JSON.stringify(newBatch), { ex: ninetyDaysSeconds });
  await kv.sadd("batch:index", newBatchId);
  await kv.sadd(`batch:by-date:${rescheduleDate}`, newBatchId);
  await kv.expire(`batch:by-date:${rescheduleDate}`, ninetyDaysSeconds);

  await logAudit({
    action: "survey_batch_scheduled",
    userId,
    userRole,
    resourceType: "batch",
    resourceId: newBatchId,
    metadata: {
      date: rescheduleDate,
      entryCount: String(entriesToResend.length),
      resendFromDates: `${fromDate} to ${toDate}`,
      sourceBatchCount: String(sourceBatches.length),
    },
  });

  return NextResponse.json({
    success: true,
    batchId: newBatchId,
    count: entriesToResend.length,
    sourceBatches: sourceBatches.length,
    scheduledFor: `${rescheduleDate} ${rescheduleTime} Denver`,
  });
}
