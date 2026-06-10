import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import type { SurveyTemplate } from "@/types";

export async function GET() {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  const ids = await kv.smembers("survey:template:index");
  const templates: SurveyTemplate[] = [];

  for (const id of ids) {
    const raw = await kv.get<string>(`survey:template:${id}`);
    if (!raw) continue;
    const t: SurveyTemplate = typeof raw === "string" ? JSON.parse(raw) : raw;
    templates.push(t);
  }

  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const { error } = await requireRole(["owner"]);
  if (error) return error;

  const { name, questions } = await request.json();
  if (!name || !questions) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const template: SurveyTemplate = {
    id: crypto.randomUUID(),
    name,
    questions,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(`survey:template:${template.id}`, JSON.stringify(template));
  await kv.sadd("survey:template:index", template.id);

  return NextResponse.json({ success: true, template });
}
