import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { encrypt, decrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import { normalizePhone, phoneIndexKey } from "@/lib/phone";
import type { Client } from "@/types";

export async function GET(request: Request) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const clientIds = await kv.smembers("client:index");
  const clients = [];

  for (const id of clientIds) {
    const raw = await kv.get<string>(`client:${id}`);
    if (!raw) continue;
    const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!client.active) continue;
    const firstName = decrypt(client.firstName);
    const lastName = decrypt(client.lastName);
    clients.push({
      ...client,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      email: client.email ? decrypt(client.email) : undefined,
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
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const { firstName, lastName, phone, email, clinicianId } = await request.json();
  if (!firstName || !lastName || !phone) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const client: Client = {
    id,
    firstName: encrypt(firstName),
    lastName: encrypt(lastName),
    email: email ? encrypt(email) : undefined,
    phone: encrypt(normalizedPhone),
    clinicianId: clinicianId || undefined,
    optedInAt: new Date().toISOString(),
    active: true,
  };

  await kv.set(`client:${id}`, JSON.stringify(client));
  await kv.sadd("client:index", id);
  await kv.set(phoneIndexKey(normalizedPhone), id);

  await logAudit({
    action: "client_added",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "client",
    resourceId: id,
  });

  return NextResponse.json({ success: true, clientId: id });
}
