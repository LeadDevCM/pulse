import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const secret = request.headers.get("x-webhook-secret");
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const purgeDays = Number(process.env.AUTO_PURGE_DAYS || 90);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - purgeDays);

  let purgedCount = 0;

  // Clean up date indexes older than cutoff
  const cutoffDate = cutoff.toISOString().split("T")[0];
  // Scan for response:by-date keys older than cutoff
  // Since we can't easily scan by pattern in KV, we iterate backwards from cutoff
  for (let i = 0; i < 10; i++) {
    const d = new Date(cutoff);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().split("T")[0];

    const tokens = await kv.smembers(`response:by-date:${dateKey}`);
    for (const token of tokens) {
      // Remove from clinician indexes
      // The actual response key is already expired via TTL
      const responseRaw = await kv.get<string>(`response:${token}`);
      if (responseRaw) {
        const response = typeof responseRaw === "string" ? JSON.parse(responseRaw) : responseRaw;
        await kv.zrem(`response:by-clinician:${response.clinicianId}`, token);
      }
      purgedCount++;
    }

    await kv.del(`response:by-date:${dateKey}`);
  }

  await logAudit({
    action: "responses_purged",
    userId: "system",
    userRole: "system",
    resourceType: "response",
    metadata: { count: String(purgedCount), cutoffDate: cutoff.toISOString() },
  });

  return NextResponse.json({ purged: purgedCount });
}
