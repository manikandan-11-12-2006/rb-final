export type ReminderStatus = 'scheduled' | 'sent' | 'completed' | 'skipped';

export interface ReminderRecord {
  patientName: string;
  maskedPhone: string;
  visitDate: string;
  feedbackStatus: 'pending' | 'completed';
  day3Status: ReminderStatus;
  day3SentAt?: string;
  day10Status: ReminderStatus;
  day10SentAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  startDate: string;
  status: 'active' | 'paused' | 'completed';
  totalPatients: number;
  responded: number;
  reminders: ReminderRecord[];
}
