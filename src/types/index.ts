export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'owner' | 'clinician' | 'office_manager' | 'super_admin';
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

export interface Client {
  id: string;
  name: string;       // ENCRYPTED in storage
  email?: string;     // ENCRYPTED in storage
  phone: string;      // ENCRYPTED in storage (E.164 before encryption)
  clinicianId?: string;
  optedInAt: string;
  active: boolean;
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
  scheduledBy: string;
  entries: BatchEntry[];
  createdAt: string;
}

export interface BatchEntry {
  clientId: string;
  clinicianId: string;
  appointmentTime: string;
  sendAfterMinutes: number;
  status: 'pending' | 'sent' | 'failed';
  sendId?: string;
}

export type Role = 'owner' | 'clinician' | 'office_manager' | 'super_admin';

export type AuditAction =
  | 'client_added'
  | 'client_removed'
  | 'survey_sent'
  | 'survey_batch_sent'
  | 'response_submitted'
  | 'response_viewed'
  | 'responses_purged'
  | 'client_roster_viewed'
  | 'dashboard_accessed'
  | 'login_success'
  | 'login_failed'
  | 'user_created'
  | 'user_modified'
  | 'clients_imported';

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
