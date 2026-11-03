import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { encrypt } from "@/lib/encryption";
import { normalizePhone, phoneIndexKey } from "@/lib/phone";
import { logAudit } from "@/lib/audit";
import type { Client, Clinician } from "@/types";

interface ImportRow {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  clinicianName?: string;
  clinicianId?: string;
  status?: string;
  frequency?: string;
  startDate?: string;
}

async function buildClinicianNameMap(): Promise<Record<string, string>> {
  const ids = await kv.smembers("clinician:index");
  const map: Record<string, string> = {};
  for (const id of ids) {
    const raw = await kv.get<string>(`clinician:${id}`);
    if (!raw) continue;
    const c: Clinician = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (c.active) {
      map[c.name.toLowerCase()] = c.id;
    }
  }
  return map;
}

export async function POST(request: Request) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const { clients } = (await request.json()) as { clients: ImportRow[] };
  if (!Array.isArray(clients) || clients.length === 0) {
    return NextResponse.json({ error: "missing_clients" }, { status: 400 });
  }

  const clinicianNameMap = await buildClinicianNameMap();

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of clients) {
    if (!row.firstName || !row.lastName) {
      skipped++;
      errors.push(`Skipped: missing name for "${row.firstName || ""} ${row.lastName || ""}"`);
      continue;
    }

    let phone: string | undefined;
    if (row.phone) {
      const normalized = normalizePhone(row.phone);
      if (normalized) {
        phone = normalized;
      } else {
        errors.push(`Warning: invalid phone "${row.phone}" for "${row.firstName} ${row.lastName}" — imported without phone`);
      }
    }

    let clinicianId = row.clinicianId;
    if (!clinicianId && row.clinicianName) {
      clinicianId = clinicianNameMap[row.clinicianName.toLowerCase()];
      if (!clinicianId) {
        errors.push(`Warning: unknown clinician "${row.clinicianName}" for "${row.firstName} ${row.lastName}" — imported without clinician`);
      }
    }

    const id = crypto.randomUUID();
    const client: Client = {
      id,
      firstName: encrypt(row.firstName),
      lastName: encrypt(row.lastName),
      email: row.email ? encrypt(row.email) : undefined,
      phone: phone ? encrypt(phone) : encrypt(""),
      clinicianId: clinicianId || undefined,
      optedInAt: new Date().toISOString(),
      active: true,
      status: (row.status as Client["status"]) || "active",
      frequency: (row.frequency as Client["frequency"]) || undefined,
      startDate: row.startDate || undefined,
    };

    await kv.set(`client:${id}`, JSON.stringify(client));
    await kv.sadd("client:index", id);
    if (phone) await kv.set(phoneIndexKey(phone), id);
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
