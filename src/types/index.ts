export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'partner' | 'clinician' | 'office_manager' | 'super_admin';
  clinicianId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Clinician {
  id: string;
  name: string;
  active: boolean;
}

export type ClientStatus = 'active' | 'inactive' | 'terminated';
export type SessionFrequency = 'weekly' | 'every_other_week' | 'monthly' | 'as_needed' | 'never_seen';

export const TERMINATION_REASONS = [
  'Client achieved goals',
  'Client-no communication',
  'Client requested',
  'Referred out',
  'Insurance/financial',
  'Clinician recommendation',
  'Other',
] as const;

export const SESSION_FREQUENCY_LABELS: Record<SessionFrequency, string> = {
  weekly: 'Weekly',
  every_other_week: 'Every Other Week',
  monthly: 'Monthly',
  as_needed: 'As Needed',
  never_seen: 'Never Seen',
};

export interface Client {
  id: string;
  firstName: string;  // ENCRYPTED in storage
  lastName: string;   // ENCRYPTED in storage
  email?: string;     // ENCRYPTED in storage
  phone: string;      // ENCRYPTED in storage (E.164 before encryption)
  clinicianId?: string;
  optedInAt: string;
  optedOut?: boolean;
  optedOutAt?: string;
  /** Double opt-in by text (SMS_DOUBLE_OPT_IN). Unset = never prompted. */
  smsConsent?: 'pending' | 'confirmed';
  smsConsentRequestedAt?: string;
  smsConsentConfirmedAt?: string;
  active: boolean;
  /** Office confirmed this client has given permission to receive SMS. */
  smsApproved?: boolean;
  // Retention tracking
  status?: ClientStatus;
  frequency?: SessionFrequency;
  startDate?: string;
  lastApptDate?: string;
  terminatedAt?: string;
  terminationReason?: string;
  notes?: string;  // ENCRYPTED in storage
}

export interface SurveyTemplate {
  id: string;
  name: string;
  questions: SurveyQuestion[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'rating' | 'multiple_choice' | 'free_text';
  options?: string[];
  ratingScale?: {
    min: number;
    max: number;
    minLabel: string;
    maxLabel: string;
  };
  required: boolean;
  order: number;
}

export interface SurveySend {
  id: string;
  clientId: string;
  clinicianId: string;
  templateId: string;
  token: string;
  sentAt: string;
  sentBy: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'completed' | 'expired';
  completedAt?: string;
  expiresAt: string;
}

export interface SurveyResponse {
  token: string;
  clinicianId: string;
  templateId: string;
  answers: SurveyAnswer[];  // ENCRYPTED in storage (serialized then encrypted)
  submittedAt: string;
  expiresAt: string;
}

export interface SurveyAnswer {
  questionId: string;
  value: string | number;
}

export interface ScheduledBatch {
  id: string;
  date: string;
  templateId: string;
  scheduledBy: string;
  entries: BatchEntry[];
  createdAt: string;
}

export interface BatchEntry {
  clientId: string;
  clinicianId: string;
  appointmentTime: string;
  sendAfterMinutes: number;
  status: 'pending' | 'sent' | 'failed' | 'consent_pending' | 'expired';
  sendId?: string;
}

export type Role = 'partner' | 'clinician' | 'office_manager' | 'super_admin';

export type AuditAction =
  | 'client_added'
  | 'client_removed'
  | 'survey_sent'
  | 'survey_batch_scheduled'
  | 'batch_dispatch_run'
  | 'response_submitted'
  | 'response_viewed'
  | 'responses_purged'
  | 'client_roster_viewed'
  | 'dashboard_accessed'
  | 'login_success'
  | 'login_failed'
  | 'user_created'
  | 'user_modified'
  | 'clients_imported'
  | 'clients_purged'
  | 'client_opted_out'
  | 'client_opted_in'
  | 'sms_consent_requested'
  | 'sms_consent_confirmed'
  | 'client_updated'
  | 'retention_updated'
  | 'report_viewed';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  userId: string;
  userRole: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, string>;
  ip?: string;
}
