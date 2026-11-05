import { kv } from "@/lib/kv";
import type { AuditEntry } from "@/types";

const SIX_YEARS_SECONDS = Math.floor(6 * 365.25 * 24 * 60 * 60);

export async function logAudit(
  entry: Omit<AuditEntry, "id" | "timestamp">
): Promise<void> {
  const id = `audit:${Date.now()}:${crypto.randomUUID()}`;
  const fullEntry: AuditEntry = {
    ...entry,
    id,
    timestamp: new Date().toISOString(),
  };

  await kv.set(id, JSON.stringify(fullEntry), { ex: SIX_YEARS_SECONDS });
  await kv.zadd("audit:index", { score: Date.now(), member: id });
}

export async function getAuditLogs(
  startDate: Date,
  endDate: Date,
  limit = 100,
  offset = 0
): Promise<{ entries: AuditEntry[]; total: number }> {
  const total = await kv.zcount(
    "audit:index",
    startDate.getTime(),
    endDate.getTime()
  );

  const ids = await kv.zrange<string[]>(
    "audit:index",
    startDate.getTime(),
    endDate.getTime(),
    { byScore: true, offset, count: limit }
  );

  const entries = await Promise.all(
    ids.map(async (id) => {
      const raw = await kv.get(id as string);
      if (!raw) return null;
      return (typeof raw === "string" ? JSON.parse(raw) : raw) as AuditEntry;
    })
  );

  return { entries: entries.filter((e): e is AuditEntry => e !== null), total };
}
