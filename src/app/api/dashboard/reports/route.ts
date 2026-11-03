import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { decrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import type { Clinician, SurveyTemplate, Client } from "@/types";

export async function GET(request: Request) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const url = new URL(request.url);
  const clinicianId = url.searchParams.get("clinicianId");
  const days = Number(url.searchParams.get("days") || "90");

  if (!clinicianId) {
    return NextResponse.json(
      { error: "clinicianId query parameter is required" },
      { status: 400 }
    );
  }

  // Validate clinician exists
  const clinicianRaw = await kv.get<string>(`clinician:${clinicianId}`);
  if (!clinicianRaw) {
    return NextResponse.json(
      { error: "Clinician not found" },
      { status: 400 }
    );
  }
  const clinician: Clinician =
    typeof clinicianRaw === "string" ? JSON.parse(clinicianRaw) : clinicianRaw;

  // ── Retention data ──────────────────────────────────────────────────
  const clientIds = await kv.smembers("client:index");

  let activeCount = 0;
  let inactiveCount = 0;
  let terminatedCount = 0;
  const frequencies: Record<string, number> = {};
  const terminationReasons: Record<string, number> = {};
  let lastUpdated: string | null = null;

  for (const id of clientIds) {
    const raw = await kv.get<string>(`client:${id}`);
    if (!raw) continue;
    const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (client.clinicianId !== clinicianId) continue;

    // Determine status — default to 'active' if status is undefined and client.active is true
    const status: string =
      client.status ?? (client.active ? "active" : "inactive");

    if (status === "active") activeCount++;
    else if (status === "inactive") inactiveCount++;
    else if (status === "terminated") terminatedCount++;

    // Frequency breakdown
    if (client.frequency) {
      frequencies[client.frequency] = (frequencies[client.frequency] || 0) + 1;
    }

    // Termination reason breakdown
    if (client.terminationReason) {
      terminationReasons[client.terminationReason] =
        (terminationReasons[client.terminationReason] || 0) + 1;
    }

    // Track most recent lastApptDate
    if (client.lastApptDate) {
      if (!lastUpdated || client.lastApptDate > lastUpdated) {
        lastUpdated = client.lastApptDate;
      }
    }
  }

  const totalClients = activeCount + inactiveCount + terminatedCount;
  const retentionDenominator = activeCount + terminatedCount;
  const retentionRate =
    retentionDenominator > 0
      ? Math.round((activeCount / retentionDenominator) * 10000) / 10000
      : 0;

  // ── Survey data ─────────────────────────────────────────────────────

  // Load templates to identify rating questions
  const templateIds = await kv.smembers("survey:template:index");
  const ratingQuestions: Record<
    string,
    { id: string; text: string }
  > = {};
  for (const tid of templateIds) {
    const raw = await kv.get<string>(`survey:template:${tid}`);
    if (!raw) continue;
    const t: SurveyTemplate =
      typeof raw === "string" ? JSON.parse(raw) : raw;
    for (const q of t.questions) {
      if (q.type === "rating") {
        ratingQuestions[q.id] = { id: q.id, text: q.text };
      }
    }
  }

  // Iterate each day in the lookback window
  const today = new Date();
  let totalSent = 0;
  let totalCompleted = 0;

  const questionTotals: Record<string, number> = {};
  const questionCounts: Record<string, number> = {};

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];

    // Count sends
    const sendIds = await kv.smembers(`send:by-date:${dateKey}`);
    for (const sendId of sendIds) {
      const raw = await kv.get<string>(`send:${sendId}`);
      if (!raw) continue;
      const send = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (send.clinicianId !== clinicianId) continue;
      totalSent++;
      if (send.status === "completed") totalCompleted++;
    }

    // Aggregate responses
    const tokens = await kv.smembers(`response:by-date:${dateKey}`);
    for (const token of tokens) {
      const raw = await kv.get<string>(`response:${token}`);
      if (!raw) continue;
      const response = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (response.clinicianId !== clinicianId) continue;

      try {
        const answers = JSON.parse(decrypt(response.answers));
        for (const answer of answers) {
          if (
            typeof answer.value === "number" &&
            ratingQuestions[answer.questionId]
          ) {
            questionTotals[answer.questionId] =
              (questionTotals[answer.questionId] || 0) + answer.value;
            questionCounts[answer.questionId] =
              (questionCounts[answer.questionId] || 0) + 1;
          }
        }
      } catch {
        // skip malformed response data
      }
    }
  }

  const responseRate =
    totalSent > 0
      ? Math.round((totalCompleted / totalSent) * 10000) / 10000
      : 0;

  // Per-question averages
  const questionAverages = Object.entries(questionTotals).map(
    ([qid, total]) => ({
      questionId: qid,
      text: ratingQuestions[qid]?.text ?? qid,
      average:
        Math.round((total / questionCounts[qid]) * 100) / 100,
    })
  );

  // Overall average across all rating answers
  let overallTotal = 0;
  let overallCount = 0;
  for (const [qid, total] of Object.entries(questionTotals)) {
    overallTotal += total;
    overallCount += questionCounts[qid];
  }
  const overallAverage =
    overallCount > 0
      ? Math.round((overallTotal / overallCount) * 100) / 100
      : 0;

  // ── Audit log ───────────────────────────────────────────────────────
  await logAudit({
    action: "report_viewed",
    userId: session!.user.id,
    userRole: session!.user.role,
    resourceType: "report",
    resourceId: clinicianId,
    metadata: { days: String(days) },
  });

  return NextResponse.json({
    clinician: { id: clinicianId, name: clinician.name },
    retention: {
      totalClients,
      active: activeCount,
      inactive: inactiveCount,
      terminated: terminatedCount,
      retentionRate,
      frequencies,
      terminationReasons,
      lastUpdated,
    },
    survey: {
      totalSent,
      totalCompleted,
      responseRate,
      overallAverage,
      questionAverages,
    },
    generatedAt: new Date().toISOString(),
  });
}
