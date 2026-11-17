import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { requireRole } from "@/lib/auth-guard";
import { decrypt } from "@/lib/encryption";
import type { SurveySend, Client, SurveyTemplate } from "@/types";

export async function GET(request: Request) {
  const { error, session } = await requireRole(["partner", "office_manager"]);
  if (error) return error;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Math.min(Number(url.searchParams.get("limit") || "30"), 100);
  const clinicianId = url.searchParams.get("clinicianId") || "";
  const days = Number(url.searchParams.get("days") || "30");

  const allSendIds: string[] = [];
  const now = new Date();
  for (let d = 0; d < days; d++) {
    const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dateKey = date.toISOString().split("T")[0];
    const ids = await kv.smembers(`send:by-date:${dateKey}`);
    allSendIds.push(...ids);
  }

  const sends: (SurveySend & { clientName?: string; clientFirstName?: string; clientLastName?: string; templateName?: string })[] = [];
  const clientCache: Record<string, { first: string; last: string }> = {};
  const templateCache: Record<string, string> = {};

  for (const sid of allSendIds) {
    const raw = await kv.get(`send:${sid}`);
    if (!raw) continue;
    const send: SurveySend = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (clinicianId && send.clinicianId !== clinicianId) continue;

    if (!clientCache[send.clientId]) {
      const cRaw = await kv.get(`client:${send.clientId}`);
      if (cRaw) {
        const client: Client = typeof cRaw === "string" ? JSON.parse(cRaw) : cRaw;
        try {
          clientCache[send.clientId] = { first: decrypt(client.firstName), last: decrypt(client.lastName) };
        } catch {
          clientCache[send.clientId] = { first: "Unknown", last: "" };
        }
      } else {
        clientCache[send.clientId] = { first: "Unknown", last: "" };
      }
    }

    if (!templateCache[send.templateId]) {
      const tRaw = await kv.get(`survey:template:${send.templateId}`);
      if (tRaw) {
        const t: SurveyTemplate = typeof tRaw === "string" ? JSON.parse(tRaw) : tRaw;
        templateCache[send.templateId] = t.name;
      } else {
        templateCache[send.templateId] = "Unknown";
      }
    }

    const cached = clientCache[send.clientId];
    sends.push({
      ...send,
      clientName: `${cached.first} ${cached.last}`.trim(),
      clientFirstName: cached.first,
      clientLastName: cached.last,
      templateName: templateCache[send.templateId],
    });
  }

  sends.sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  const total = sends.length;
  const offset = (page - 1) * limit;
  const paginated = sends.slice(offset, offset + limit);

  return NextResponse.json({ sends: paginated, total, page, totalPages: Math.ceil(total / limit) });
}
