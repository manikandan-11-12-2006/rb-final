export interface Patient {
  id: string;
  name: string;
  phone: string;
  maskedPhone: string;
  visitDate: string;
  visitId: string;
  doctor?: string;
  department?: string;
}

export interface PatientSession {
  sessionId: string;
  patientName: string;
  clinicName: string;
  visitDate: string;
  feedbackId?: string;
}

export type SendStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';

export interface PatientRow extends Patient {
  sendStatus: SendStatus;
  sentAt?: string;
}

export interface HospitalConfig {
  hospitalName: string;
  websiteUrl: string;
  googleReviewUrl: string;
}
