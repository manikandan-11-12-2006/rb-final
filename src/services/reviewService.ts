/**
 * reviewService.ts
 *
 * Handles the AI cleanup and Google Review integration boundary.
 *
 * Integration boundaries:
 *   - AI cleanup: Frontend → reviewService → (later) backend → Gemini API
 *   - Google Review URL: configured via VITE_GOOGLE_REVIEW_URL env var
 */

import { mockAiTransformations } from '../data/mockData';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Simulate AI review cleanup (Gemini integration point)
// ---------------------------------------------------------------------------
export async function generateCleanedReview(
  originalFeedback: string,
  feedbackType: 'text' | 'voice'
): Promise<{ cleanedReview: string; processingTime: number }> {
  const start = Date.now();
  await delay(1500); // simulate Gemini latency

  // Mock transformation: in production, this calls the backend which calls Gemini
  const cleanedReview =
    feedbackType === 'voice'
      ? mockAiTransformations.voice
      : originalFeedback.length > 80
      ? mockAiTransformations.default
      : originalFeedback;

  return {
    cleanedReview,
    processingTime: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Get the configured Google Review URL
// ---------------------------------------------------------------------------
export function getGoogleReviewUrl(): string {
  return (
    import.meta.env.VITE_GOOGLE_REVIEW_URL ||
    'https://search.google.com/local/writereview?placeid=CONFIGURE_IN_ENV'
  );
}

// ---------------------------------------------------------------------------
// Simulate voice transcription (Sarvam API integration point)
// ---------------------------------------------------------------------------
export async function transcribeVoice(
  _audioBlob: Blob
): Promise<{ transcript: string; confidence: number }> {
  await delay(2000); // simulate Sarvam latency

  // Mock transcript – replace with actual Sarvam API call on backend
  return {
    transcript:
      'The doctor was very helpful and explained the treatment clearly. I felt well cared for throughout my visit.',
    confidence: 0.94,
  };
}
