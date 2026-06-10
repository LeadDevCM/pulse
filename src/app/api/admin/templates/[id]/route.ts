import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import type { SurveyTemplate } from "@/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  const { id } = await params;
  const raw = await kv.get<string>(`survey:template:${id}`);
  if (!raw) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const template: SurveyTemplate = typeof raw === "string" ? JSON.parse(raw) : raw;
  const updates = await request.json();

  if (updates.name !== undefined) template.name = updates.name;
  if (updates.questions !== undefined) template.questions = updates.questions;
  if (updates.active !== undefined) template.active = updates.active;
  template.updatedAt = new Date().toISOString();

  await kv.set(`survey:template:${id}`, JSON.stringify(template));

  return NextResponse.json({ success: true, template });
}
