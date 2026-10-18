import type { Feedback, FeedbackStats } from '../types/feedback';
import type { Campaign } from '../types/campaign';

// ---------------------------------------------------------------------------
// Mock feedback records – fictional patients, masked phone numbers
// ---------------------------------------------------------------------------
export const mockFeedbackList: Feedback[] = [
  {
    id: 'fb-10001',
    patientName: 'Priya Sharma',
    phone: '+91 98765 44821',
    maskedPhone: '+91 98765 44821',
    visitDate: '2026-09-25',
    visitId: 'VIS-25091',
    rating: 5,
    originalFeedback:
      'The doctor was really nice and explained everything very clearly and the staff were also very helpful.',
    cleanedReview:
      'The doctor explained everything clearly, and the staff were very helpful.',
    feedbackType: 'text',
    transcriptionStatus: 'not_required',
    reviewStatus: 'completed',
    followUpStatus: 'none',
    channel: 'whatsapp',
    feedbackSubmittedAt: '2026-09-25T14:32:00Z',
    reviewOpenedAt: '2026-09-25T14:35:00Z',
    reviewCompletedAt: '2026-09-25T14:38:00Z',
    whatsappSentAt: '2026-09-25T13:00:00Z',
    createdAt: '2026-09-25T13:00:00Z',
  },
  {
    id: 'fb-10002',
    patientName: 'Arun Kumar',
    phone: '+91 98450 13302',
    maskedPhone: '+91 98450 13302',
    visitDate: '2026-09-25',
    visitId: 'VIS-25092',
    rating: 4,
    originalFeedback:
      'Good experience overall. The waiting time was a bit long but the doctor was very thorough.',
    cleanedReview:
      'Good experience overall. The doctor was thorough and attentive.',
    feedbackType: 'text',
    transcriptionStatus: 'not_required',
    reviewStatus: 'redirected',
    followUpStatus: 'none',
    channel: 'whatsapp',
    feedbackSubmittedAt: '2026-09-25T16:10:00Z',
    reviewOpenedAt: '2026-09-25T16:14:00Z',
    whatsappSentAt: '2026-09-25T15:00:00Z',
    createdAt: '2026-09-25T15:00:00Z',
  },
  {
    id: 'fb-10003',
    patientName: 'Meena Ramanathan',
    phone: '+91 97123 47719',
    maskedPhone: '+91 97123 47719',
    visitDate: '2026-09-24',
    visitId: 'VIS-24087',
    rating: 2,
    originalFeedback:
      'The waiting time was very long and the front desk staff was not helpful at all.',
    feedbackType: 'text',
    transcriptionStatus: 'not_required',
    reviewStatus: 'follow_up_required',
    followUpStatus: 'required',
    channel: 'whatsapp',
    feedbackSubmittedAt: '2026-09-24T11:20:00Z',
    whatsappSentAt: '2026-09-24T10:00:00Z',
    createdAt: '2026-09-24T10:00:00Z',
  },
  {
    id: 'fb-10004',
    patientName: 'Rahul Kapoor',
    phone: '+91 98888 75540',
    maskedPhone: '+91 98888 75540',
    visitDate: '2026-09-24',
    visitId: 'VIS-24088',
    rating: 5,
    originalFeedback:
      'Excellent service. The doctor was very patient and took time to explain my condition in detail.',
    cleanedReview:
      'Excellent service. The doctor was patient and explained my condition in detail.',
    feedbackType: 'voice',
    transcriptionStatus: 'completed',
    reviewStatus: 'review_ready',
    followUpStatus: 'none',
    channel: 'whatsapp',
    feedbackSubmittedAt: '2026-09-24T15:45:00Z',
    whatsappSentAt: '2026-09-24T14:00:00Z',
    createdAt: '2026-09-24T14:00:00Z',
  },
  {
    id: 'fb-10005',
    patientName: 'Divya Ananthan',
    phone: '+91 99887 78834',
    maskedPhone: '+91 99887 78834',
    visitDate: '2026-09-23',
    visitId: 'VIS-23081',
    rating: 3,
    originalFeedback:
      'The experience was okay. Nothing special but nothing bad either.',
    feedbackType: 'text',
    transcriptionStatus: 'not_required',
    reviewStatus: 'follow_up_required',
    followUpStatus: 'contacted',
    channel: 'whatsapp',
    feedbackSubmittedAt: '2026-09-23T10:05:00Z',
    whatsappSentAt: '2026-09-23T09:00:00Z',
    createdAt: '2026-09-23T09:00:00Z',
  },
  {
    id: 'fb-10006',
    patientName: 'Suresh Muthu',
    phone: '+91 96666 52291',
    maskedPhone: '+91 96666 52291',
    visitDate: '2026-09-23',
    visitId: 'VIS-23082',
    rating: 1,
    originalFeedback:
      'Very disappointed. Had to wait 2 hours and the doctor barely spent 5 minutes.',
    feedbackType: 'text',
    transcriptionStatus: 'not_required',
    reviewStatus: 'follow_up_required',
    followUpStatus: 'resolved',
    channel: 'whatsapp',
    feedbackSubmittedAt: '2026-09-23T14:30:00Z',
    whatsappSentAt: '2026-09-23T13:00:00Z',
    createdAt: '2026-09-23T13:00:00Z',
  },
  {
    id: 'fb-10007',
    patientName: 'Anita Patel',
    phone: '+91 98222 36612',
    maskedPhone: '+91 98222 36612',
    visitDate: '2026-09-22',
    visitId: 'VIS-22079',
    rating: 4,
    originalFeedback:
      'The doctor was very knowledgeable. I feel much better after the consultation.',
    cleanedReview:
      'The doctor was knowledgeable and the consultation was helpful.',
    feedbackType: 'text',
    transcriptionStatus: 'not_required',
    reviewStatus: 'completed',
    followUpStatus: 'none',
    channel: 'whatsapp',
    feedbackSubmittedAt: '2026-09-22T11:00:00Z',
    reviewOpenedAt: '2026-09-22T11:04:00Z',
    reviewCompletedAt: '2026-09-22T11:07:00Z',
    whatsappSentAt: '2026-09-22T10:00:00Z',
    createdAt: '2026-09-22T10:00:00Z',
  },
  {
    id: 'fb-10008',
    patientName: 'Vijay Natarajan',
    phone: '+91 97333 49903',
    maskedPhone: '+91 97333 49903',
    visitDate: '2026-09-22',
    visitId: 'VIS-22080',
    rating: 5,
    originalFeedback: 'Prompt and clear medical advice.',
    cleanedReview: 'Prompt and clear medical advice.',
    feedbackType: 'voice',
    transcriptionStatus: 'completed',
    reviewStatus: 'completed',
    followUpStatus: 'none',
    channel: 'whatsapp',
    whatsappSentAt: '2026-09-22T16:00:00Z',
    createdAt: '2026-09-22T16:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Dashboard statistics
// ---------------------------------------------------------------------------
export const mockStats: FeedbackStats = {
  totalVisits: 1248,
  requestsSent: 1024,
  responsesReceived: 782,
  googleReviewsCompleted: 491,
  followUpsRequired: 37,
  responseRate: 76.4,
  conversionRate: 62.8,
};

// ---------------------------------------------------------------------------
// Campaign / reminder data
// ---------------------------------------------------------------------------
export const mockCampaign: Campaign = {
  id: 'camp-001',
  name: 'September 2026 – Ongoing',
  startDate: '2026-09-01',
  status: 'active',
  totalPatients: 312,
  responded: 238,
  reminders: [
    {
      patientName: 'Priya S.',
      maskedPhone: '+91 ******4821',
      visitDate: '2026-09-25',
      feedbackStatus: 'completed',
      day3Status: 'skipped',
      day10Status: 'skipped',
    },
    {
      patientName: 'Arun K.',
      maskedPhone: '+91 ******3302',
      visitDate: '2026-09-25',
      feedbackStatus: 'completed',
      day3Status: 'skipped',
      day10Status: 'skipped',
    },
    {
      patientName: 'Meena R.',
      maskedPhone: '+91 ******7719',
      visitDate: '2026-09-24',
      feedbackStatus: 'completed',
      day3Status: 'skipped',
      day10Status: 'skipped',
    },
    {
      patientName: 'Rahul K.',
      maskedPhone: '+91 ******5540',
      visitDate: '2026-09-24',
      feedbackStatus: 'completed',
      day3Status: 'skipped',
      day10Status: 'skipped',
    },
    {
      patientName: 'Kavya T.',
      maskedPhone: '+91 ******1127',
      visitDate: '2026-09-21',
      feedbackStatus: 'pending',
      day3Status: 'sent',
      day3SentAt: '2026-09-24T09:00:00Z',
      day10Status: 'scheduled',
    },
    {
      patientName: 'Mohan B.',
      maskedPhone: '+91 ******4456',
      visitDate: '2026-09-18',
      feedbackStatus: 'pending',
      day3Status: 'sent',
      day3SentAt: '2026-09-21T09:00:00Z',
      day10Status: 'sent',
      day10SentAt: '2026-09-28T09:00:00Z',
    },
    {
      patientName: 'Lakshmi G.',
      maskedPhone: '+91 ******8801',
      visitDate: '2026-09-20',
      feedbackStatus: 'pending',
      day3Status: 'sent',
      day3SentAt: '2026-09-23T09:00:00Z',
      day10Status: 'scheduled',
    },
    {
      patientName: 'Ravi S.',
      maskedPhone: '+91 ******3374',
      visitDate: '2026-09-15',
      feedbackStatus: 'pending',
      day3Status: 'sent',
      day3SentAt: '2026-09-18T09:00:00Z',
      day10Status: 'sent',
      day10SentAt: '2026-09-25T09:00:00Z',
    },
  ],
};

// ---------------------------------------------------------------------------
// AI mock transformations used in the AI cleanup UI
// ---------------------------------------------------------------------------
export const mockAiTransformations: Record<string, string> = {
  default:
    'The doctor was patient and explained everything clearly. The staff were helpful and professional.',
  voice:
    'The doctor was very helpful and explained the treatment clearly. I felt well cared for throughout my visit.',
  star4:
    'Good experience overall. The doctor was thorough and the consultation was helpful.',
  star5:
    'Excellent service. The doctor was knowledgeable and took time to explain everything clearly.',
};
