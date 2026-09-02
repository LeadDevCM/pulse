import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";

export async function GET() {
  const { error } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);

  const [sendsMonth, responsesMonth, sendsAll, responsesAll] = await Promise.all([
    kv.get<number>(`stats:sends:${monthKey}`),
    kv.get<number>(`stats:responses:${monthKey}`),
    kv.get<number>("stats:sends:all"),
    kv.get<number>("stats:responses:all"),
  ]);

  const totalSendsMonth = sendsMonth ?? 0;
  const totalCompletedMonth = responsesMonth ?? 0;
  const totalSendsAll = sendsAll ?? 0;
  const totalCompletedAll = responsesAll ?? 0;

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
