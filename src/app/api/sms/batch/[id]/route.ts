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

  const total = batch.entries.length;
  const sent = batch.entries.filter((e) => e.status === "sent").length;
  const failed = batch.entries.filter((e) => e.status === "failed").length;
  const pending = batch.entries.filter((e) => e.status === "pending").length;

  return NextResponse.json({
    batch: {
      id: batch.id,
      date: batch.date,
      createdAt: batch.createdAt,
      total,
      sent,
      failed,
      pending,
      complete: pending === 0,
      entries: batch.entries,
    },
  });
}
