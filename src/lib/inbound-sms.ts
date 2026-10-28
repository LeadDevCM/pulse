import { kv } from "@/lib/kv";
import { decrypt } from "@/lib/encryption";
import { logAudit } from "@/lib/audit";
import { normalizePhone, phoneIndexKey } from "@/lib/phone";
import { confirmConsentAndRelease, doubleOptInEnabled } from "@/lib/survey-dispatch";
import type { Client } from "@/types";

/**
 * Inbound SMS compliance handling, shared by every provider's webhook.
 *
 * Only compliance keywords are acted on; any other text is ignored. Keywords
 * must be the whole message (ignoring punctuation/case) — a substring match
 * would opt someone out for texting "I need to cancel my appointment".
 */
const OPT_OUT_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout", "opt out"]);
const OPT_IN_KEYWORDS = new Set(["start", "unstop", "yes", "subscribe"]);

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

export type InboundOutcome = "opted_out" | "opted_in" | "ignored";

export async function handleInboundSms(fromPhone: string | undefined, text: string | undefined): Promise<InboundOutcome> {
  const word = keyword(text);
  const optingOut = OPT_OUT_KEYWORDS.has(word);
  const optingIn = OPT_IN_KEYWORDS.has(word);
  if (!fromPhone || (!optingOut && !optingIn)) return "ignored";

  const normalized = normalizePhone(fromPhone);
  if (!normalized) return "ignored";

  const match = await findClientByPhone(normalized);
  if (!match) return "ignored";

  const { id, client } = match;
  if (optingOut) {
    if (client.optedOut) return "ignored";
    client.optedOut = true;
    client.optedOutAt = new Date().toISOString();
    await kv.set(`client:${id}`, JSON.stringify(client));
    await logAudit({ action: "client_opted_out", userId: "system", userRole: "system", resourceType: "client", resourceId: id });
    return "opted_out";
  }

  // Opting in: clear any opt-out, and (with double opt-in) confirm consent and
  // release a survey that was parked waiting on this reply.
  let changed = false;
  if (client.optedOut) {
    client.optedOut = false;
    client.optedOutAt = undefined;
    changed = true;
    await kv.set(`client:${id}`, JSON.stringify(client));
    await logAudit({ action: "client_opted_in", userId: "system", userRole: "system", resourceType: "client", resourceId: id });
  }
  if (doubleOptInEnabled() && client.smsConsent !== "confirmed") {
    await confirmConsentAndRelease(id, client);
    changed = true;
  } else if (doubleOptInEnabled()) {
    // Already confirmed; still release anything parked.
    await confirmConsentAndRelease(id, client);
  }
  return changed ? "opted_in" : "ignored";
}
