export type FeedbackType = 'text' | 'voice';

export type TranscriptionStatus = 'not_required' | 'pending' | 'completed';

export type ReviewStatus =
  | 'not_started'
  | 'review_ready'
  | 'redirected'
  | 'completed'
  | 'follow_up_required';

export type FollowUpStatus = 'none' | 'required' | 'contacted' | 'resolved';
export type SentimentType = 'positive' | 'negative' | 'neutral';

export interface Feedback {
  id: string;
  hospitalId?: string;
  patientName: string;
  maskedPhone: string;
  phone?: string;
  visitDate: string;
  visitId: string;
  rating: number;
  sentiment?: SentimentType;
  sentimentScore?: number;
  healthcareTopic?: string;
  aiSuggestedSolution?: string;
  patientResponseMessage?: string;
  originalFeedback?: string;
  cleanedReview?: string;
  feedbackType: FeedbackType;
  transcriptionStatus: TranscriptionStatus;
  reviewStatus: ReviewStatus;
  followUpStatus: FollowUpStatus;
  channel: 'whatsapp' | 'web';
  feedbackSubmittedAt?: string;
  reviewOpenedAt?: string;
  reviewCompletedAt?: string;
  whatsappSentAt?: string;
  createdAt: string;
}

export interface SubmitFeedbackPayload {
  sessionId: string;
  rating: number;
  feedbackType: FeedbackType;
  patientName?: string;
  phone?: string;
  visitId?: string;
  originalFeedback?: string;
  voiceTranscript?: string;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId: string;
  reviewStatus: ReviewStatus;
  cleanedReview?: string;
  message: string;
}

export interface FeedbackStats {
  totalVisits: number;
  requestsSent: number;
  responsesReceived: number;
  googleReviewsCompleted: number;
  followUpsRequired: number;
  responseRate: number;
  conversionRate: number;
}
