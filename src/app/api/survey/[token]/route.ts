import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { validateToken } from "@/lib/tokens";
import type { SurveyTemplate } from "@/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await validateToken(token);

  if (!result.valid) {
    const status = result.reason === "not_found" ? 404 : 410;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const raw = await kv.get<string>(`survey:template:${result.send!.templateId}`);
  if (!raw) {
    return NextResponse.json({ error: "template_not_found" }, { status: 404 });
  }

  const template: SurveyTemplate = typeof raw === "string" ? JSON.parse(raw) : raw;

  return NextResponse.json({
    questions: template.questions.sort((a, b) => a.order - b.order),
    templateName: template.name,
  });
}
