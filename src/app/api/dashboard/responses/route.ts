import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
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
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 100);
  const offset = (page - 1) * limit;

  let tokens: string[] = [];

  if (clinicianId) {
    const start = startDate ? new Date(startDate).getTime() : 0;
    const end = endDate ? new Date(endDate).getTime() : Date.now();
    tokens = await kv.zrange<string[]>(
      `response:by-clinician:${clinicianId}`,
      start,
      end,
      { byScore: true, offset, count: limit, rev: true }
    );
  } else {
    // Owner with no filter -- get recent by date
    const today = new Date();
    for (let i = 0; i < 30 && tokens.length < limit; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const dayTokens = await kv.smembers(`response:by-date:${dateKey}`);
      tokens.push(...(dayTokens as string[]));
    }
    tokens = tokens.slice(offset, offset + limit);
  }

  const responses = await Promise.all(
    tokens.map(async (token) => {
      const raw = await kv.get<string>(`response:${token}`);
      if (!raw) return null;
      const response = typeof raw === "string" ? JSON.parse(raw) : raw;
      try {
        response.answers = JSON.parse(decrypt(response.answers));
      } catch {
        response.answers = [];
      }
      return response;
    })
  );

  await logAudit({
    action: "response_viewed",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "response",
    metadata: { count: String(responses.filter(Boolean).length), clinicianId: clinicianId || "all" },
  });

  return NextResponse.json({ responses: responses.filter(Boolean), page, limit });
}
