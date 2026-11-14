import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import type { ScheduledBatch } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const { id } = await params;
  const raw = await kv.get<string>(`batch:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "batch_not_found" }, { status: 404 });
  }

  const batch: ScheduledBatch = typeof raw === "string" ? JSON.parse(raw) : raw;

  let templateName = "";
  if (batch.templateId) {
    const tRaw = await kv.get(`survey:template:${batch.templateId}`);
    if (tRaw) {
      const t = typeof tRaw === "string" ? JSON.parse(tRaw) : tRaw;
      templateName = t.name || "";
    }
  }

  const total = batch.entries.length;
  const sent = batch.entries.filter((e) => e.status === "sent").length;
  const failed = batch.entries.filter((e) => e.status === "failed").length;
  const expired = batch.entries.filter((e) => e.status === "expired").length;
  const pending = batch.entries.filter((e) => e.status === "pending" || e.status === "consent_pending").length;

  return NextResponse.json({
    batch: {
      id: batch.id,
      date: batch.date,
      templateId: batch.templateId,
      templateName,
      createdAt: batch.createdAt,
      total,
      sent,
      failed,
      expired,
      pending,
      complete: pending === 0,
      entries: batch.entries,
    },
  });
}
