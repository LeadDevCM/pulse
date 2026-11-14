import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { dispatchSurvey } from "@/lib/survey-dispatch";
import { logAudit } from "@/lib/audit";
import type { ScheduledBatch, Client } from "@/types";

const STALENESS_HOURS = 4;
const LOCK_TTL_SECONDS = 300;

function todayDenver(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
}

function yesterdayDenver(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Denver" });
}

/** Compute the absolute UTC send time for a batch entry. */
function sendTimeUtc(batchDate: string, appointmentTime: string, sendAfterMinutes: number): Date {
  const [hours, minutes] = appointmentTime.split(":").map(Number);

  // Derive Denver's UTC offset on this date by comparing a reference point
  const refUtc = new Date(`${batchDate}T12:00:00Z`);
  const denverRepr = new Date(refUtc.toLocaleString("en-US", { timeZone: "America/Denver" }));
  const offsetMs = denverRepr.getTime() - refUtc.getTime();

  // Treat the appointment time as UTC, then adjust by the offset to get real UTC
  const localAsUtc = new Date(`${batchDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`);
  const utc = new Date(localAsUtc.getTime() - offsetMs);
  utc.setMinutes(utc.getMinutes() + sendAfterMinutes);
  return utc;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const today = todayDenver();
  const yesterday = yesterdayDenver();

  const todayIds = await kv.smembers(`batch:by-date:${today}`);
  const yesterdayIds = await kv.smembers(`batch:by-date:${yesterday}`);
  const batchIds = [...new Set([...todayIds, ...yesterdayIds])];

  let dispatched = 0;
  let expired = 0;
  let skipped = 0;

  for (const batchId of batchIds) {
    const raw = await kv.get<string>(`batch:${batchId}`);
    if (!raw) continue;
    const batch: ScheduledBatch = typeof raw === "string" ? JSON.parse(raw) : raw;

    let batchModified = false;

    for (let i = 0; i < batch.entries.length; i++) {
      const entry = batch.entries[i];
      if (entry.status !== "pending") continue;

      const sendAt = sendTimeUtc(batch.date, entry.appointmentTime, entry.sendAfterMinutes);
      if (sendAt > now) {
        skipped++;
        continue;
      }

      const hoursPastDue = (now.getTime() - sendAt.getTime()) / (1000 * 60 * 60);
      if (hoursPastDue > STALENESS_HOURS) {
        batch.entries[i].status = "expired";
        batchModified = true;
        expired++;
        continue;
      }

      const lockKey = `batch:claim:${batchId}:${i}`;
      const claimed = await kv.set(lockKey, "1", { nx: true, ex: LOCK_TTL_SECONDS });
      if (!claimed) {
        skipped++;
        continue;
      }

      const rawClient = await kv.get<string>(`client:${entry.clientId}`);
      if (!rawClient) {
        batch.entries[i].status = "failed";
        batchModified = true;
        continue;
      }

      const client: Client = typeof rawClient === "string" ? JSON.parse(rawClient) : rawClient;

      if (client.optedOut) {
        batch.entries[i].status = "failed";
        batchModified = true;
        continue;
      }

      try {
        const result = await dispatchSurvey({
          clientId: entry.clientId,
          client,
          clinicianId: entry.clinicianId,
          templateId: batch.templateId,
          sentBy: batch.scheduledBy,
          sentByRole: "system",
        });

        if (!result || result.kind === "failed") {
          batch.entries[i].status = "failed";
        } else if (result.kind === "consent_requested") {
          batch.entries[i].status = "consent_pending";
        } else {
          batch.entries[i].status = "sent";
          batch.entries[i].sendId = result.kind === "sent" ? result.send.id : undefined;
          dispatched++;
        }
      } catch {
        batch.entries[i].status = "failed";
      }
      batchModified = true;
    }

    if (batchModified) {
      await kv.set(`batch:${batchId}`, JSON.stringify(batch));
    }
  }

  if (dispatched > 0 || expired > 0) {
    await logAudit({
      action: "batch_dispatch_run",
      userId: "system",
      userRole: "system",
      resourceType: "batch",
      metadata: {
        dispatched: String(dispatched),
        expired: String(expired),
        skipped: String(skipped),
      },
    });
  }

  return NextResponse.json({ dispatched, expired, skipped, checked: batchIds.length });
}
