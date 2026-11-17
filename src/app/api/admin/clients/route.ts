import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { encrypt, decrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import { normalizePhone, phoneIndexKey } from "@/lib/phone";
import type { Client, SurveySend } from "@/types";

export async function GET(request: Request) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const clientIds = await kv.smembers("client:index");

  // Build a map of clientId -> most recent sentAt (scan last 90 days)
  const lastSentMap: Record<string, string> = {};
  const now = new Date();
  for (let d = 0; d < 90; d++) {
    const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split("T")[0];
    const sendIds = await kv.smembers(`send:by-date:${dateKey}`);
    for (const sid of sendIds) {
      const raw = await kv.get(`send:${sid}`);
      if (!raw) continue;
      const send: SurveySend = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!lastSentMap[send.clientId] || send.sentAt > lastSentMap[send.clientId]) {
        lastSentMap[send.clientId] = send.sentAt;
      }
    }
  }

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
      notes: client.notes ? decrypt(client.notes) : undefined,
      lastSurveySentAt: lastSentMap[id] || null,
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

  const { firstName, lastName, phone, email, clinicianId, status, frequency, startDate, notes } = await request.json();
  if (!firstName || !lastName || !phone) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const existingId = await kv.get<string>(phoneIndexKey(normalizedPhone));
  if (existingId) {
    return NextResponse.json(
      { error: "duplicate_phone", message: "A client with this phone number already exists", clientId: existingId },
      { status: 409 }
    );
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
    status: status || 'active',
    frequency: frequency || undefined,
    startDate: startDate || undefined,
    notes: notes ? encrypt(notes) : undefined,
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
