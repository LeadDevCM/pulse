import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { encrypt } from "@/lib/encryption";
import { normalizePhone } from "@/lib/phone";
import { logAudit } from "@/lib/audit";
import type { Client } from "@/types";

interface ImportRow {
  name: string;
  email?: string;
  phone: string;
  clinicianId?: string;
}

export async function POST(request: Request) {
  const { error, session } = await requireRole(["owner", "office_manager"]);
  if (error) return error;

  const { clients } = (await request.json()) as { clients: ImportRow[] };
  if (!Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json({ error: "missing_clients" }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of clients) {
    if (!row.name || !row.phone) {
      skipped++;
      errors.push(`Skipped: missing name or phone for "${row.name || "unknown"}"`);
      continue;
    }

    const phone = normalizePhone(row.phone);
    if (!phone) {
      skipped++;
      errors.push(`Skipped: invalid phone "${row.phone}" for "${row.name}"`);
      continue;
    }

    const id = crypto.randomUUID();
    const client: Client = {
      id,
      name: encrypt(row.name),
      email: row.email ? encrypt(row.email) : undefined,
      phone: encrypt(phone),
      clinicianId: row.clinicianId || undefined,
      optedInAt: new Date().toISOString(),
      active: true,
    };

    await kv.set(`client:${id}`, JSON.stringify(client));
    await kv.sadd("client:index", id);
    imported++;
  }

  await logAudit({
    action: "clients_imported",
    userId: session.user.id,
    userRole: session.user.role,
    resourceType: "client",
    metadata: {
      imported: String(imported),
      skipped: String(skipped),
    },
  });

  return NextResponse.json({ success: true, imported, skipped, errors });
}
