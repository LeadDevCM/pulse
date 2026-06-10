import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import type { Clinician } from "@/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  const { id } = await params;
  const raw = await kv.get<string>(`clinician:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const clinician: Clinician = typeof raw === "string" ? JSON.parse(raw) : raw;
  const updates = await request.json();

  if (updates.name !== undefined) clinician.name = updates.name;
  if (updates.active !== undefined) clinician.active = updates.active;

  await kv.set(`clinician:${id}`, JSON.stringify(clinician));

  return NextResponse.json({ success: true, clinician });
}
