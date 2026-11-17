import { sendText } from "@/lib/sms";

const ADMIN_ALERT_PHONE = "+14352331911";

interface DispatchFailureParams {
  clientName: string;
  reason: string;
  batchDate: string;
}

export function notifyDispatchFailure({ clientName, reason, batchDate }: DispatchFailureParams): void {
  sendText(
    ADMIN_ALERT_PHONE,
    `Pulse survey failed: ${clientName} (${batchDate})\nReason: ${reason}`
  ).catch(() => {});
}
