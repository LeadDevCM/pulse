import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { SurveyResponse } from "@/types";

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

  await kv.del(`response:${token}`);

  const dateKey = response.submittedAt.split("T")[0];
  await kv.srem(`response:by-date:${dateKey}`, token);

  if (response.clinicianId) {
    await kv.zrem(`response:by-clinician:${response.clinicianId}`, token);
  }

  const monthKey = response.submittedAt.slice(0, 7);
  await kv.decr(`stats:responses:${monthKey}`);
  await kv.decr("stats:responses:all");

  await logAudit({
    action: "response_submitted",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "response",
    resourceId: token,
    metadata: { action: "purged", clinicianId: response.clinicianId },
  });

  return NextResponse.json({ success: true });
}
