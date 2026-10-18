import { useState, useCallback } from 'react';
import type { SubmitFeedbackPayload, FeedbackResponse } from '../types/feedback';
import { submitFeedback } from '../services/feedbackService';

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';

interface UseFeedbackReturn {
  state: SubmissionState;
  response: FeedbackResponse | null;
  error: string | null;
  submit: (payload: SubmitFeedbackPayload) => Promise<void>;
  reset: () => void;
}

/**
 * useFeedback
 *
 * Manages the patient-side feedback submission lifecycle.
 * Wraps feedbackService.submitFeedback() with loading / error state.
 */
export function useFeedback(): UseFeedbackReturn {
  const [state, setState] = useState<SubmissionState>('idle');
  const [response, setResponse] = useState<FeedbackResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (payload: SubmitFeedbackPayload) => {
    setState('submitting');
    setError(null);
    try {
      const res = await submitFeedback(payload);
      setResponse(res);
      setState('success');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong while submitting your feedback. Please try again.';
      setError(message);
      setState('error');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setResponse(null);
    setError(null);
  }, []);

  return { state, response, error, submit, reset };
}
