import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { decrypt } from "@/lib/encryption";
import { phoneIndexKey } from "@/lib/phone";
import type { Client } from "@/types";

export async function POST() {
  const { error, session } = await requireRole(["partner"]);
  if (error) return error;

  const clientIds = await kv.smembers("client:index");
  let purgedCount = 0;

  for (const id of clientIds) {
    const raw = await kv.get<string>(`client:${id}`);
    if (raw) {
      const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;
      try {
        await kv.del(phoneIndexKey(decrypt(client.phone)));
      } catch {
        // index entry is best-effort; the client record itself is removed below
      }
    }
    await kv.del(`client:${id}`);
    await kv.srem("client:index", id);
    purgedCount++;
  }

  await logAudit({
    action: "clients_purged",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "client",
    metadata: { count: String(purgedCount) },
  });

  return NextResponse.json({ purged: purgedCount });
}
