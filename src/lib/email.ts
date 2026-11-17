/**
 * Minimal email notifications for dispatch failures.
 *
 * Gracefully no-ops when RESEND_API_KEY is absent so the cron dispatch
 * never crashes due to email configuration issues.
 *
 * HIPAA: client names are PHI. The email body is kept minimal — no
 * logging of PHI occurs here. The Resend SDK transmits over TLS.
 */
import { Resend } from "resend";

const DEFAULT_FROM = "Pulse <noreply@mendingmindsutah.com>";
const DEFAULT_TO = "david@cedarcitywebdesign.com";

interface DispatchFailureParams {
  clientName: string;
  reason: string;
  batchDate: string;
}

export function notifyDispatchFailure({ clientName, reason, batchDate }: DispatchFailureParams): void {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const to = process.env.ADMIN_NOTIFICATION_EMAIL || DEFAULT_TO;
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  // Fire-and-forget — intentionally not awaited
  resend.emails
    .send({
      from,
      to,
      subject: `Survey delivery failed — ${clientName}`,
      text: [
        `A survey could not be delivered.`,
        ``,
        `Client: ${clientName}`,
        `Reason: ${reason}`,
        `Batch date: ${batchDate}`,
        ``,
        `Please check the client roster and update accordingly.`,
      ].join("\n"),
    })
    .catch(() => {
      // Swallow — email failures must never disrupt the dispatch pipeline
    });
}
