import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { SurveyResponse, SurveySend } from "@/types";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const { token } = await params;
  const raw = await kv.get(`response:${token}`);
  if (!raw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const response: SurveyResponse = typeof raw === "string" ? JSON.parse(raw) : raw;

  // Remove the response
  await kv.del(`response:${token}`);

  const dateKey = response.submittedAt.split("T")[0];
  await kv.srem(`response:by-date:${dateKey}`, token);

  if (response.clinicianId) {
    await kv.zrem(`response:by-clinician:${response.clinicianId}`, token);
  }

  // Decrement response stats
  const monthKey = response.submittedAt.slice(0, 7);
  await kv.decr(`stats:responses:${monthKey}`);
  await kv.decr("stats:responses:all");

  // Revert the send record from "completed" so reports don't count it
  const sendRaw = await kv.get(`send:token:${token}`);
  if (sendRaw) {
    const send: SurveySend = typeof sendRaw === "string" ? JSON.parse(sendRaw) : sendRaw;
    if (send.status === "completed") {
      send.status = "sent";
      send.completedAt = undefined;
      const sendJson = JSON.stringify(send);
      await kv.set(`send:token:${token}`, sendJson);
      await kv.set(`send:${send.id}`, sendJson);
    }
  }

  await logAudit({
    action: "responses_purged",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "response",
    resourceId: token,
    metadata: { clinicianId: response.clinicianId },
  });

  return NextResponse.json({ success: true });
}
