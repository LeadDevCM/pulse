import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { decrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const { error, session } = await requireRole(["owner", "clinician"]);
  if (error) return error;

  const url = new URL(request.url);
  const clinicianId = session.user.role === "clinician"
    ? session.user.clinicianId!
    : url.searchParams.get("clinicianId") || undefined;
  const days = Number(url.searchParams.get("days") || "30");
  const groupBy = url.searchParams.get("groupBy") || "day";

  const trends: Record<string, { count: number; totals: Record<string, number>; counts: Record<string, number> }> = {};

  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    const dayTokens = await kv.smembers(`response:by-date:${dateKey}`);

    for (const token of dayTokens) {
      const raw = await kv.get<string>(`response:${token}`);
      if (!raw) continue;
      const response = typeof raw === "string" ? JSON.parse(raw) : raw;

      if (clinicianId && response.clinicianId !== clinicianId) continue;

      let groupKey: string;
      if (groupBy === "week") {
        const weekStart = new Date(d);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        groupKey = weekStart.toISOString().split("T")[0];
      } else if (groupBy === "month") {
        groupKey = dateKey.substring(0, 7);
      } else {
        groupKey = dateKey;
      }

      if (!trends[groupKey]) {
        trends[groupKey] = { count: 0, totals: {}, counts: {} };
      }
      trends[groupKey].count++;

      try {
        const answers = JSON.parse(decrypt(response.answers));
        for (const answer of answers) {
          if (typeof answer.value === "number") {
            trends[groupKey].totals[answer.questionId] = (trends[groupKey].totals[answer.questionId] || 0) + answer.value;
            trends[groupKey].counts[answer.questionId] = (trends[groupKey].counts[answer.questionId] || 0) + 1;
          }
        }
      } catch {
        // Skip malformed responses
      }
    }
  }

  // Compute averages
  const trendData = Object.entries(trends)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, data]) => {
      const averages: Record<string, number> = {};
      for (const [qId, total] of Object.entries(data.totals)) {
        averages[qId] = Math.round((total / data.counts[qId]) * 100) / 100;
      }
      return { period, responseCount: data.count, averages };
    });

  await logAudit({
    action: "dashboard_accessed",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "trends",
    metadata: { clinicianId: clinicianId || "all", days: String(days) },
  });

  return NextResponse.json({ trends: trendData });
}
