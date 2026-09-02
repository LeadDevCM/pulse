import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { decrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";
import type { Client } from "@/types";

const OPT_OUT_KEYWORDS = ["stop", "unsubscribe", "cancel", "quit", "opt out"];

export async function POST(request: Request) {
  const body = await request.json();

  const event = body?.data;
  if (!event) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const fromPhone = event.payload?.from?.phone_number;
  const messageText = (event.payload?.text || "").trim().toLowerCase();

  if (!fromPhone || !OPT_OUT_KEYWORDS.some((kw) => messageText.includes(kw))) {
    return NextResponse.json({ received: true });
  }

  const normalized = normalizePhone(fromPhone);
  const clientIds = await kv.smembers("client:index");

  for (const id of clientIds) {
    const raw = await kv.get<string>(`client:${id}`);
    if (!raw) continue;
    const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!client.active) continue;

    const decryptedPhone = decrypt(client.phone);
    if (normalizePhone(decryptedPhone) === normalized) {
      client.optedOut = true;
      client.optedOutAt = new Date().toISOString();
      await kv.set(`client:${id}`, JSON.stringify(client));

      await logAudit({
        action: "client_opted_out",
        userId: "system",
        userRole: "system",
        resourceType: "client",
        resourceId: id,
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
