import { v4 as uuidv4 } from "uuid";
import { kv } from "@/lib/kv";
import type { SurveySend } from "@/types";

export function generateToken(): string {
  return uuidv4();
}

export async function validateToken(
  token: string
): Promise<{ valid: boolean; send?: SurveySend; reason?: string }> {
  const raw = await kv.get<string>(`send:token:${token}`);
  if (!raw) {
    return { valid: false, reason: "not_found" };
  }

  const send: SurveySend = typeof raw === "string" ? JSON.parse(raw) : raw;

  if (send.status === "completed") {
    return { valid: false, reason: "already_completed" };
  }

  if (new Date(send.expiresAt) < new Date()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, send };
}
