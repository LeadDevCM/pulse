import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { encrypt, decrypt } from "@/lib/encryption";
import { normalizePhone } from "@/lib/phone";
import { logAudit } from "@/lib/audit";
import type { Client } from "@/types";

export async function PUT(
  request: Request,
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
  const updates = await request.json();

  if (updates.name !== undefined) {
    client.name = encrypt(updates.name);
  }
  if (updates.email !== undefined) {
    client.email = updates.email === "" ? undefined : encrypt(updates.email);
  }
  if (updates.phone !== undefined) {
    const normalized = normalizePhone(updates.phone);
    if (!normalized) {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }
    client.phone = encrypt(normalized);
  }
  if (updates.clinicianId !== undefined) {
    client.clinicianId = updates.clinicianId === "" ? undefined : updates.clinicianId;
  }

  await kv.set(`client:${id}`, JSON.stringify(client));

  await logAudit({
    action: "client_added",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "client",
    resourceId: id,
  });

  return NextResponse.json({
    success: true,
    client: {
      ...client,
      name: decrypt(client.name),
      email: client.email ? decrypt(client.email) : undefined,
      phone: decrypt(client.phone),
    },
  });
}

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
