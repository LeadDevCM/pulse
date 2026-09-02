import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { decrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";

async function resolveClientName(token: string): Promise<string | undefined> {
  try {
    const sendRaw = await kv.get<string>(`send:token:${token}`);
    if (!sendRaw) return undefined;
    const send = typeof sendRaw === "string" ? JSON.parse(sendRaw) : sendRaw;
    if (!send.clientId) return undefined;
    const clientRaw = await kv.get<string>(`client:${send.clientId}`);
    if (!clientRaw) return undefined;
    const client = typeof clientRaw === "string" ? JSON.parse(clientRaw) : clientRaw;
    const firstName = decrypt(client.firstName);
    const lastName = decrypt(client.lastName);
    return `${firstName} ${lastName}`.trim();
  } catch {
    return undefined;
  }
}

export async function GET(request: Request) {
  const { error, session } = await requireRole(["partner", "clinician", "office_manager"]);
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
      end,
      start,
      { byScore: true, offset, count: limit, rev: true }
    );
  } else {
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

  const filtered = responses.filter(Boolean);
  const role = session.user.role;
  const userClinicianId = session.user.clinicianId;

  const sanitized = await Promise.all(
    filtered.map(async (r: Record<string, unknown>, i: number) => {
      if (role === "clinician") {
        return {
          id: `resp-${i}`,
          clinicianId: r.clinicianId,
          templateId: r.templateId,
          answers: r.answers,
          submittedAt: r.submittedAt,
        };
      }

      const clientName = await resolveClientName(r.token as string);

      if (role === "partner") {
        const isOwn = userClinicianId && r.clinicianId === userClinicianId;
        return { ...r, clientName: isOwn ? null : (clientName ?? null) };
      }

      // office_manager and super_admin see all client names
      return { ...r, clientName: clientName ?? null };
    })
  );

  await logAudit({
    action: "response_viewed",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "response",
    metadata: { count: String(filtered.length), clinicianId: clinicianId || "all" },
  });

  return NextResponse.json({ responses: sanitized, page, limit });
}
