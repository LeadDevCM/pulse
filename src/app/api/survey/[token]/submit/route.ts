import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { validateToken } from "@/lib/tokens";
import { encrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import type { SurveyAnswer } from "@/types";

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await validateToken(token);

  if (!result.valid) {
    const status = result.reason === "not_found" ? 404 : 410;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const body = await request.json();
  const answers: SurveyAnswer[] = body.answers;

  if (!answers || !Array.isArray(answers)) {
    return NextResponse.json({ error: "invalid_answers" }, { status: 400 });
  }

  const send = result.send!;
  const now = new Date();

  const encryptedAnswers = encrypt(JSON.stringify(answers));

  const storedResponse = {
    token,
    clinicianId: send.clinicianId,
    templateId: send.templateId,
    answers: encryptedAnswers,
    submittedAt: now.toISOString(),
    expiresAt: send.expiresAt,
  };

  await kv.set(`response:${token}`, JSON.stringify(storedResponse), {
    ex: NINETY_DAYS_SECONDS,
  });

  const dateKey = now.toISOString().split("T")[0];
  await kv.sadd(`response:by-date:${dateKey}`, token);
  await kv.zadd(`response:by-clinician:${send.clinicianId}`, {
    score: now.getTime(),
    member: token,
  });

  const updatedSend = { ...send, status: "completed" as const, completedAt: now.toISOString() };
  await kv.set(`send:token:${token}`, JSON.stringify(updatedSend));
  await kv.set(`send:${send.id}`, JSON.stringify(updatedSend));

  await logAudit({
    action: "response_submitted",
    userId: "anonymous",
    userRole: "client",
    resourceType: "response",
    resourceId: token,
  });

  return NextResponse.json({ success: true });
}
