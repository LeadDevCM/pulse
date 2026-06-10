import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import type { Clinician } from "@/types";

export async function GET() {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  const ids = await kv.smembers("clinician:index");
  const clinicians: Clinician[] = [];

  for (const id of ids) {
    const raw = await kv.get<string>(`clinician:${id}`);
    if (!raw) continue;
    const c: Clinician = typeof raw === "string" ? JSON.parse(raw) : raw;
    clinicians.push(c);
  }

  return NextResponse.json({ clinicians });
}

export async function POST(request: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  const { name } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "missing_name" }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const clinician: Clinician = { id, name, active: true };

  await kv.set(`clinician:${id}`, JSON.stringify(clinician));
  await kv.sadd("clinician:index", id);

  return NextResponse.json({ success: true, clinician });
}
