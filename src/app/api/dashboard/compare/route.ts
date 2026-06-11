import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { decrypt } from "@/lib/encryption";
import type { Clinician, SurveyTemplate } from "@/types";

export async function GET(request: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") || "30");

  // Load clinicians
  const clinicianIds = await kv.smembers("clinician:index");
  const clinicianMap: Record<string, Clinician> = {};
  for (const id of clinicianIds) {
    const raw = await kv.get<string>(`clinician:${id}`);
    if (!raw) continue;
    const c: Clinician = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (c.active) clinicianMap[id] = c;
  }

  // Load templates to identify rating questions
  const templateIds = await kv.smembers("survey:template:index");
  const ratingQuestions: Record<string, { id: string; text: string; type: string }> = {};
  for (const tid of templateIds) {
    const raw = await kv.get<string>(`survey:template:${tid}`);
    if (!raw) continue;
    const t: SurveyTemplate = typeof raw === "string" ? JSON.parse(raw) : raw;
    for (const q of t.questions) {
      if (q.type === "rating") {
        ratingQuestions[q.id] = { id: q.id, text: q.text, type: q.type };
      }
    }
  }

  // Collect per-clinician, per-question totals
  const stats: Record<string, {
    totalResponses: number;
    questionTotals: Record<string, number>;
    questionCounts: Record<string, number>;
  }> = {};

  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];
    const tokens = await kv.smembers(`response:by-date:${dateKey}`);

    for (const token of tokens) {
      const raw = await kv.get<string>(`response:${token}`);
      if (!raw) continue;
      const response = typeof raw === "string" ? JSON.parse(raw) : raw;
      const cid = response.clinicianId;
      if (!clinicianMap[cid]) continue;

      if (!stats[cid]) {
        stats[cid] = { totalResponses: 0, questionTotals: {}, questionCounts: {} };
      }
      stats[cid].totalResponses++;

      try {
        const answers = JSON.parse(decrypt(response.answers));
        for (const answer of answers) {
          if (typeof answer.value === "number" && ratingQuestions[answer.questionId]) {
            stats[cid].questionTotals[answer.questionId] =
              (stats[cid].questionTotals[answer.questionId] || 0) + answer.value;
            stats[cid].questionCounts[answer.questionId] =
              (stats[cid].questionCounts[answer.questionId] || 0) + 1;
          }
        }
      } catch {
        // skip malformed
      }
    }
  }

  // Build response
  const clinicians = Object.entries(stats).map(([cid, data]) => {
    const questionAverages: Record<string, number> = {};
    let overallTotal = 0;
    let overallCount = 0;

    for (const [qid, total] of Object.entries(data.questionTotals)) {
      const avg = Math.round((total / data.questionCounts[qid]) * 100) / 100;
      questionAverages[qid] = avg;
      overallTotal += total;
      overallCount += data.questionCounts[qid];
    }

    return {
      clinicianId: cid,
      clinicianName: clinicianMap[cid].name,
      totalResponses: data.totalResponses,
      overallAverage: overallCount > 0 ? Math.round((overallTotal / overallCount) * 100) / 100 : 0,
      questionAverages,
    };
  }).sort((a, b) => b.overallAverage - a.overallAverage);

  const questions = Object.values(ratingQuestions).map((q) => ({
    id: q.id,
    text: q.text,
  }));

  return NextResponse.json({ clinicians, questions });
}
