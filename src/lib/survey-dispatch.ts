/**
 * One place that creates and delivers a survey, shared by the admin send
 * screen, the n8n batch trigger, and the consent webhook.
 *
 * Double opt-in (SMS_DOUBLE_OPT_IN=true): a client whose `smsConsent` is not
 * "confirmed" gets a plain-text consent prompt instead of the survey. Their
 * survey request is parked; when they reply YES the inbound handler confirms
 * consent and dispatches the parked survey. This keeps the first message to
 * any contact link-free, which Sendblue requires before a contact has replied.
 */
import { kv } from "@/lib/kv";
import { decrypt } from "@/lib/encryption";
import { generateToken } from "@/lib/tokens";
import { sendSurveyLink, sendText, type DeliveryMode } from "@/lib/sms";
import { logAudit } from "@/lib/audit";
import type { Client, SurveySend } from "@/types";

const NINETY_DAYS = 90 * 24 * 60 * 60;
const PENDING_TTL = 14 * 24 * 60 * 60;
const PROMPT_COOLDOWN = 24 * 60 * 60;

export const CONSENT_PROMPT_TEXT =
  "Mending Minds would like to send you a short feedback request by text after your sessions. Reply YES to accept or STOP to decline.";

export function doubleOptInEnabled(): boolean {
  return process.env.SMS_DOUBLE_OPT_IN === "true";
}

export function consentConfirmed(client: Client): boolean {
  if (!doubleOptInEnabled()) return true;
  return client.smsConsent === "confirmed";
}

export interface DispatchRequest {
  clientId: string;
  client: Client;
  clinicianId: string;
  templateId: string;
  sentBy: string;
  sentByRole: string;
  linkOnly?: boolean;
}

export type DispatchResult =
  | { kind: "sent"; send: SurveySend; surveyUrl: string; deliveryMode: DeliveryMode; messageId: string }
  | { kind: "link_only"; send: SurveySend; surveyUrl: string }
  | { kind: "consent_requested"; prompted: boolean }
  | { kind: "failed"; send: SurveySend; detail: string };

const pendingKey = (clientId: string) => `consent:pending:${clientId}`;
const promptedKey = (clientId: string) => `consent:prompted:${clientId}`;

/** Park a survey request until the client confirms consent, and prompt them
 *  (at most once per 24h). */
async function requestConsent(req: DispatchRequest): Promise<DispatchResult> {
  const { clientId, client } = req;
  await kv.set(
    pendingKey(clientId),
    JSON.stringify({
      clinicianId: req.clinicianId,
      templateId: req.templateId,
      sentBy: req.sentBy,
      sentByRole: req.sentByRole,
      requestedAt: new Date().toISOString(),
    }),
    { ex: PENDING_TTL }
  );

  const recentlyPrompted = await kv.get(promptedKey(clientId));
  if (recentlyPrompted) return { kind: "consent_requested", prompted: false };

  await sendText(decrypt(client.phone), CONSENT_PROMPT_TEXT);
  await kv.set(promptedKey(clientId), Date.now(), { ex: PROMPT_COOLDOWN });

  if (client.smsConsent !== "pending") {
    client.smsConsent = "pending";
    client.smsConsentRequestedAt = new Date().toISOString();
    await kv.set(`client:${clientId}`, JSON.stringify(client));
  }

  await logAudit({
    action: "sms_consent_requested",
    userId: req.sentBy,
    userRole: req.sentByRole,
    resourceType: "client",
    resourceId: clientId,
  });
  return { kind: "consent_requested", prompted: true };
}

export async function dispatchSurvey(req: DispatchRequest): Promise<DispatchResult> {
  const { clientId, client, clinicianId, templateId } = req;

  if (!consentConfirmed(client)) {
    return requestConsent(req);
  }

  const phone = decrypt(client.phone);
  const token = generateToken();
  const now = new Date();
  const expiryHours = Number(process.env.SURVEY_LINK_EXPIRY_HOURS || 48);
  const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

  const send: SurveySend = {
    id: `send:${crypto.randomUUID()}`,
    clientId,
    clinicianId,
    templateId,
    token,
    sentAt: now.toISOString(),
    sentBy: req.sentBy,
    status: "pending",
    expiresAt: expiresAt.toISOString(),
  };

  const surveyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/survey/${token}`;

  if (req.linkOnly) {
    send.status = "sent";
    await kv.set(`send:${send.id}`, JSON.stringify(send), { ex: NINETY_DAYS });
    await kv.set(`send:token:${token}`, JSON.stringify(send), { ex: NINETY_DAYS });

    const dateKey = now.toISOString().split("T")[0];
    await kv.sadd(`send:by-date:${dateKey}`, send.id);
    const monthKey = now.toISOString().slice(0, 7);
    await kv.incr(`stats:sends:${monthKey}`);
    await kv.incr("stats:sends:all");

    await logAudit({
      action: "survey_sent",
      userId: req.sentBy,
      userRole: req.sentByRole,
      resourceType: "survey",
      resourceId: send.id,
      metadata: { clientId, clinicianId, deliveryMode: "link_only" },
    });

    return { kind: "link_only", send, surveyUrl };
  }

  try {
    const result = await sendSurveyLink(phone, surveyUrl);
    send.status = "sent";

    await kv.set(`send:${send.id}`, JSON.stringify(send), { ex: NINETY_DAYS });
    await kv.set(`send:token:${token}`, JSON.stringify(send), { ex: NINETY_DAYS });
    if (result.messageId && result.messageId !== "unknown") {
      await kv.set(`sms:msgid:${result.messageId}`, send.id, { ex: NINETY_DAYS });
    }

    const dateKey = now.toISOString().split("T")[0];
    await kv.sadd(`send:by-date:${dateKey}`, send.id);
    const monthKey = now.toISOString().slice(0, 7);
    await kv.incr(`stats:sends:${monthKey}`);
    await kv.incr("stats:sends:all");

    await logAudit({
      action: "survey_sent",
      userId: req.sentBy,
      userRole: req.sentByRole,
      resourceType: "survey",
      resourceId: send.id,
      metadata: { clientId, clinicianId, messageId: result.messageId, deliveryMode: result.deliveryMode },
    });

    return { kind: "sent", send, surveyUrl, deliveryMode: result.deliveryMode, messageId: result.messageId };
  } catch (err: unknown) {
    send.status = "failed";
    await kv.set(`send:${send.id}`, JSON.stringify(send), { ex: NINETY_DAYS });
    const detail = err instanceof Error ? err.message : String(err);
    return { kind: "failed", send, detail };
  }
}

/** Called when a client confirms consent: marks them confirmed and sends any
 *  survey that was parked waiting on them. */
export async function confirmConsentAndRelease(clientId: string, client: Client): Promise<DispatchResult | null> {
  if (client.smsConsent !== "confirmed") {
    client.smsConsent = "confirmed";
    client.smsConsentConfirmedAt = new Date().toISOString();
    await kv.set(`client:${clientId}`, JSON.stringify(client));
    await logAudit({
      action: "sms_consent_confirmed",
      userId: "system",
      userRole: "system",
      resourceType: "client",
      resourceId: clientId,
    });
  }

  const raw = await kv.get<string>(pendingKey(clientId));
  if (!raw) return null;
  const pending = typeof raw === "string" ? JSON.parse(raw) : raw;
  await kv.del(pendingKey(clientId));

  return dispatchSurvey({
    clientId,
    client,
    clinicianId: pending.clinicianId,
    templateId: pending.templateId,
    sentBy: pending.sentBy,
    sentByRole: pending.sentByRole,
  });
}
