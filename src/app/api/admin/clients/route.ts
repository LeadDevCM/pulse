import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireRole } from "@/lib/auth-guard";
import { encrypt, decrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import type { Client } from "@/types";

export async function GET(request: Request) {
  const { error, session } = await requireRole(["owner", "office_manager"]);
  if (error) return error;

  const clientIds = await kv.smembers("client:index");
  const clients: Client[] = [];

  for (const id of clientIds) {
    const raw = await kv.get<string>(`client:${id}`);
    if (!raw) continue;
    const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!client.active) continue;
    clients.push({
      ...client,
      name: decrypt(client.name),
      phone: decrypt(client.phone),
    });
  }

  await logAudit({
    action: "client_roster_viewed",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "client",
    metadata: { count: String(clients.length) },
  });

  return NextResponse.json({ clients });
}

export async function POST(request: Request) {
  const { error, session } = await requireRole(["owner", "office_manager"]);
  if (error) return error;

  const { name, phone, clinicianId } = await request.json();
  if (!name || !phone || !clinicianId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const client: Client = {
    id,
    name: encrypt(name),
    phone: encrypt(phone),
    clinicianId,
    optedInAt: new Date().toISOString(),
    active: true,
  };

  await kv.set(`client:${id}`, JSON.stringify(client));
  await kv.sadd("client:index", id);

  await logAudit({
    action: "client_added",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "client",
    resourceId: id,
  });

  return NextResponse.json({ success: true, clientId: id });
}
