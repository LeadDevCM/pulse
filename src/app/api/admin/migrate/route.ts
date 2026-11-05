import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { Client } from "@/types";

/**
 * POST /api/admin/migrate
 * One-shot migration: sets smsApproved=true on all existing clients
 * that don't already have the field set.
 */
export async function POST(request: Request) {
  const { error, session } = await requireRole(["partner"]);
  if (error) return error;

  const { action } = await request.json();

  if (action === "approve-existing-sms") {
    const clientIds = await kv.smembers("client:index");
    let updated = 0;

    for (const id of clientIds) {
      const raw = await kv.get<string>(`client:${id}`);
      if (!raw) continue;
      const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (client.smsApproved) continue;
      client.smsApproved = true;
      await kv.set(`client:${id}`, JSON.stringify(client));
      updated++;
    }

    await logAudit({
      action: "client_updated",
      userId: session.user.id,
      userRole: session.user.role,
      resourceType: "migration",
      metadata: { migration: "approve-existing-sms", updated: String(updated) },
    });

    return NextResponse.json({ success: true, updated, total: clientIds.length });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
