import { NextResponse } from "next/server";
import { kv } from "@/lib/kv";
import { decrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import { normalizePhone, phoneIndexKey } from "@/lib/phone";
import { readTelnyxWebhook } from "@/lib/telnyx-webhook";
import type { Client } from "@/types";

/**
 * Inbound SMS handler (Telnyx `message.received`).
 *
 * Only compliance keywords are acted on; any other text is ignored. Keywords
 * must be the whole message (ignoring punctuation/case) — a substring match
 * would opt someone out for texting "I need to cancel my appointment".
 */
const OPT_OUT_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout", "opt out"]);
const OPT_IN_KEYWORDS = new Set(["start", "unstop", "yes", "subscribe"]);

type InboundEvent = {
  data?: {
    event_type?: string;
    payload?: { from?: { phone_number?: string }; text?: string };
  };
};

function keyword(text: string | undefined): string {
  return (text || "").trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ");
}

/** Find a client by phone via the hashed index, falling back to a scan for
 *  records created before the index existed (and backfilling the index). */
async function findClientByPhone(e164: string): Promise<{ id: string; client: Client } | null> {
  const indexKey = phoneIndexKey(e164);
  const indexedId = await kv.get<string>(indexKey);
  if (indexedId) {
    const raw = await kv.get<string>(`client:${indexedId}`);
    if (raw) {
      const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (client.active) return { id: indexedId, client };
    }
  }

  const clientIds = await kv.smembers("client:index");
  for (const id of clientIds) {
    const raw = await kv.get<string>(`client:${id}`);
    if (!raw) continue;
    const client: Client = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!client.active) continue;
    if (normalizePhone(decrypt(client.phone)) === e164) {
      await kv.set(indexKey, id);
      return { id, client };
    }
  }
  return null;
}

export async function POST(request: Request) {
  const verified = await readTelnyxWebhook<InboundEvent>(request);
  if (!verified.ok) return verified.response;

  const event = verified.body?.data;
  if (!event) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  if (event.event_type && event.event_type !== "message.received") {
    return NextResponse.json({ received: true });
  }

  const fromPhone = event.payload?.from?.phone_number;
  const word = keyword(event.payload?.text);
  const optingOut = OPT_OUT_KEYWORDS.has(word);
  const optingIn = OPT_IN_KEYWORDS.has(word);

  if (!fromPhone || (!optingOut && !optingIn)) {
    return NextResponse.json({ received: true });
  }

  const normalized = normalizePhone(fromPhone);
  if (!normalized) {
    return NextResponse.json({ received: true });
  }

  const match = await findClientByPhone(normalized);
  if (!match) {
    return NextResponse.json({ received: true });
  }

  const { id, client } = match;
  if (optingOut && !client.optedOut) {
    client.optedOut = true;
    client.optedOutAt = new Date().toISOString();
  } else if (optingIn && client.optedOut) {
    client.optedOut = false;
    client.optedOutAt = undefined;
  } else {
    return NextResponse.json({ received: true });
  }

  await kv.set(`client:${id}`, JSON.stringify(client));
  await logAudit({
    action: optingOut ? "client_opted_out" : "client_opted_in",
    userId: "system",
    userRole: "system",
    resourceType: "client",
    resourceId: id,
  });

  return NextResponse.json({ received: true });
}
