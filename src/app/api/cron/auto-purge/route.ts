import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
