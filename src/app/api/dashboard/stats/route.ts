import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";

export async function GET() {
  const { error } = await requireRole(["owner", "office_manager"]);
  if (error) return error;

  const today = new Date();
  let totalSendsMonth = 0;
  let totalCompletedMonth = 0;
  let totalSendsAll = 0;
  let totalCompletedAll = 0;

  // Count sends for the current month
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    const sends = await kv.smembers(`send:by-date:${dateKey}`);
    totalSendsMonth += sends.length;

    const responses = await kv.smembers(`response:by-date:${dateKey}`);
    totalCompletedMonth += responses.length;
  }

  totalSendsAll = totalSendsMonth; // Simplified -- in production, maintain counters
  totalCompletedAll = totalCompletedMonth;

  const completionRate = totalSendsMonth > 0
    ? Math.round((totalCompletedMonth / totalSendsMonth) * 100)
    : 0;

  return NextResponse.json({
    totalSendsMonth,
    totalCompletedMonth,
    totalSendsAll,
    totalCompletedAll,
    completionRate,
  });
}
