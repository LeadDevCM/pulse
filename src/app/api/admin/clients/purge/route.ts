import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";

export async function POST() {
  const { error, session } = await requireRole(["partner"]);
  if (error) return error;

  const clientIds = await kv.smembers("client:index");
  let purgedCount = 0;

  for (const id of clientIds) {
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
