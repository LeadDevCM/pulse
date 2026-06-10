import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import type { Client } from "@/types";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(["owner", "office_manager"]);
  if (error) return error;

  const { id } = await params;
  const raw = await kv.get<string>(`client:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;
  client.active = false;
  await kv.set(`client:${id}`, JSON.stringify(client));
  await kv.srem("client:index", id);

  await logAudit({
    action: "client_removed",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "client",
    resourceId: id,
  });

  return NextResponse.json({ success: true });
}
