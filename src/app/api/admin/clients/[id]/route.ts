import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { encrypt, decrypt } from "@/lib/encryption";
import { normalizePhone, phoneIndexKey } from "@/lib/phone";
import { logAudit } from "@/lib/audit";
import type { Client } from "@/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const { id } = await params;
  const raw = await kv.get<string>(`client:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;
  const updates = await request.json();

  if (updates.firstName !== undefined) {
    client.firstName = encrypt(updates.firstName);
  }
  if (updates.lastName !== undefined) {
    client.lastName = encrypt(updates.lastName);
  }
  if (updates.email !== undefined) {
    client.email = updates.email === "" ? undefined : encrypt(updates.email);
  }
  if (updates.phone !== undefined) {
    const normalized = normalizePhone(updates.phone);
    if (!normalized) {
      return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
    }
    const previous = decrypt(client.phone);
    if (previous !== normalized) {
      await kv.del(phoneIndexKey(previous));
      await kv.set(phoneIndexKey(normalized), id);
    }
    client.phone = encrypt(normalized);
  }
  if (updates.smsConsent === "confirmed" || updates.smsConsent === "pending") {
    client.smsConsent = updates.smsConsent;
    if (updates.smsConsent === "confirmed") client.smsConsentConfirmedAt = new Date().toISOString();
  }
  if (updates.clinicianId !== undefined) {
    client.clinicianId = updates.clinicianId === "" ? undefined : updates.clinicianId;
  }
  if (updates.status !== undefined) {
    client.status = updates.status;
    if (updates.status === 'terminated') {
      client.terminatedAt = client.terminatedAt || new Date().toISOString();
    } else {
      client.terminatedAt = undefined;
      client.terminationReason = undefined;
    }
  }
  if (updates.frequency !== undefined) {
    client.frequency = updates.frequency === "" ? undefined : updates.frequency;
  }
  if (updates.startDate !== undefined) {
    client.startDate = updates.startDate === "" ? undefined : updates.startDate;
  }
  if (updates.lastApptDate !== undefined) {
    client.lastApptDate = updates.lastApptDate === "" ? undefined : updates.lastApptDate;
  }
  if (updates.terminationReason !== undefined) {
    client.terminationReason = updates.terminationReason === "" ? undefined : updates.terminationReason;
  }
  if (updates.notes !== undefined) {
    client.notes = updates.notes === "" ? undefined : encrypt(updates.notes);
  }
  if (updates.smsApproved !== undefined) {
    client.smsApproved = updates.smsApproved === true || updates.smsApproved === "true";
  }

  await kv.set(`client:${id}`, JSON.stringify(client));

  await logAudit({
    action: "client_updated",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "client",
    resourceId: id,
  });

  const firstName = decrypt(client.firstName);
  const lastName = decrypt(client.lastName);

  return NextResponse.json({
    success: true,
    client: {
      ...client,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      email: client.email ? decrypt(client.email) : undefined,
      phone: decrypt(client.phone),
      notes: client.notes ? decrypt(client.notes) : undefined,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
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
  await kv.del(phoneIndexKey(decrypt(client.phone)));

  await logAudit({
    action: "client_removed",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "client",
    resourceId: id,
  });

  return NextResponse.json({ success: true });
}
