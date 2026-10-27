import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
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

  const lockAcquired = await kv.set(`submit:lock:${token}`, "1", { nx: true, ex: 60 });
  if (!lockAcquired) {
    return NextResponse.json({ error: "already_submitted" }, { status: 409 });
  }

  const body = await request.json();
  const answers: SurveyAnswer[] = body.answers;

  if (!answers || !Array.isArray(answers)) {
    await kv.del(`submit:lock:${token}`);
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

  // Keep the send records on the same 90-day clock they started on. Writing
  // them back without a TTL would make completed sends live forever.
  const updatedSend = { ...send, status: "completed" as const, completedAt: now.toISOString() };
  const sentAtMs = Date.parse(send.sentAt) || now.getTime();
  const remainingSeconds = Math.max(
    60,
    NINETY_DAYS_SECONDS - Math.floor((now.getTime() - sentAtMs) / 1000)
  );
  await kv.set(`send:token:${token}`, JSON.stringify(updatedSend), { ex: remainingSeconds });
  await kv.set(`send:${send.id}`, JSON.stringify(updatedSend), { ex: remainingSeconds });

  const monthKey = now.toISOString().slice(0, 7);
  await kv.incr(`stats:responses:${monthKey}`);
  await kv.incr("stats:responses:all");

  await logAudit({
    action: "response_submitted",
    userId: "anonymous",
    userRole: "client",
    resourceType: "response",
    resourceId: token,
  });

  return NextResponse.json({ success: true });
}
