import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const { error, session } = await requireRole(["owner"]);
  if (error) return error;

  const purgeDays = Number(process.env.AUTO_PURGE_DAYS || 90);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - purgeDays);

  let purgedCount = 0;

  for (let i = 0; i < 10; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];

    const tokens = await kv.smembers(`response:by-date:${dateKey}`);
    for (const token of tokens) {
      const raw = await kv.get<string>(`response:${token}`);
      if (raw) {
        const response = typeof raw === "string" ? JSON.parse(raw) : raw;
        await kv.zrem(`response:by-clinician:${response.clinicianId}`, token);
        await kv.del(`response:${token}`);
      }
      purgedCount++;
    }
    await kv.del(`response:by-date:${dateKey}`);
  }

  await logAudit({
    action: "responses_purged",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "response",
    metadata: { count: String(purgedCount) },
  });

  return NextResponse.json({ purged: purgedCount });
}
