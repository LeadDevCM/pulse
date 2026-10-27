import { kv } from "@/lib/kv";
import type { SurveySend } from "@/types";

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

/** Update a send's delivery status from a provider message id. No-op if the
 *  id is unknown or the survey was already completed. */
export async function updateSendStatus(providerMessageId: string, newStatus: "delivered" | "failed"): Promise<boolean> {
  const sendId = await kv.get<string>(`sms:msgid:${providerMessageId}`);
  if (!sendId) return false;
  const raw = await kv.get<string>(`send:${sendId}`);
  if (!raw) return false;
  const send: SurveySend = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (send.status === "completed") return false;

  send.status = newStatus;
  const sentAtMs = Date.parse(send.sentAt) || Date.now();
  const remaining = Math.max(60, NINETY_DAYS_SECONDS - Math.floor((Date.now() - sentAtMs) / 1000));
  await kv.set(`send:${sendId}`, JSON.stringify(send), { ex: remaining });
  await kv.set(`send:token:${send.token}`, JSON.stringify(send), { ex: remaining });
  return true;
}
