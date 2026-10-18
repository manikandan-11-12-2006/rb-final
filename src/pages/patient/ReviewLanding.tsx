import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ExternalLink, CheckCircle, Copy, Sparkles, Heart, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { useClipboard } from '../../hooks/useClipboard';
import {
  getFeedbackById,
  markReviewOpened,
  markReviewCompleted,
} from '../../services/feedbackService';
import { getGoogleReviewUrl } from '../../services/reviewService';
import type { Feedback } from '../../types/feedback';

const clinicName = import.meta.env.VITE_CLINIC_NAME || 'ABC Healthcare';

const DEFAULT_REVIEW =
  'The doctor was patient and explained everything clearly. The staff were helpful and professional.';

export default function ReviewLanding() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { copied, copy } = useClipboard(4000);

  const [fb, setFb] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [preparing, setPreparing] = useState(true);
  const [reviewOpened, setReviewOpened] = useState(false);
  const [autoCopied, setAutoCopied] = useState<boolean | null>(null);

  // Load feedback record
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    getFeedbackById(id).then(setFb).finally(() => setLoading(false));
  }, [id]);

  // Show "preparing" animation briefly
  useEffect(() => {
    const t = setTimeout(() => setPreparing(false), 1200);
    return () => clearTimeout(t);
  }, []);

  // Attempt auto-copy once ready
  useEffect(() => {
    if (preparing || loading) return;
    const text = fb?.cleanedReview ?? DEFAULT_REVIEW;
    copy(text).then(setAutoCopied);
  // Only run once when content becomes ready
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparing, loading]);

  const reviewText = fb?.cleanedReview ?? DEFAULT_REVIEW;
  const reviewUrl = getGoogleReviewUrl();

  const handleOpenReview = async () => {
    if (id) await markReviewOpened(id);
    setReviewOpened(true);
    window.open(reviewUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCompleted = async () => {
    if (id) await markReviewCompleted(id);
    navigate(`/patient/completed/${id ?? 'demo'}`);
  };

  const handleManualCopy = async () => {
    const ok = await copy(reviewText);
    if (!ok) {
      const el = document.getElementById('review-text');
      if (el) {
        const range = document.createRange();
        range.selectNode(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (preparing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-primary-600 animate-pulse" aria-hidden />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-800">Preparing your review…</p>
          <p className="text-sm text-slate-500 mt-1">This takes just a moment.</p>
        </div>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Thank you header */}
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
          <Heart className="h-7 w-7 text-red-400 fill-red-400" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Thank you for your feedback</h1>
        <p className="text-sm text-slate-500 mt-1">
          {clinicName} appreciates you taking the time.
        </p>
      </div>

      {/* Review card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary-600" aria-hidden />
          <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
            Review prepared for you
          </p>
        </div>
        <blockquote
          id="review-text"
          className="text-base text-slate-800 leading-relaxed italic border-l-4 border-primary-400 pl-4 py-1"
        >
          "{reviewText}"
        </blockquote>
        <p className="text-xs text-slate-400 mt-3">
          AI-generated text preserves your original meaning. You can edit it freely in Google Reviews before posting.
        </p>
      </div>

      {/* Copy status */}
      {autoCopied !== null && (
        <div
          className={[
            'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium',
            autoCopied
              ? 'bg-primary-50 border border-primary-200 text-primary-800'
              : 'bg-amber-50 border border-amber-200 text-amber-800',
          ].join(' ')}
          role="status"
          aria-live="polite"
        >
          {autoCopied ? (
            <>
              <CheckCircle className="h-5 w-5 text-primary-500 shrink-0" aria-hidden />
              Review copied ✓ — paste it directly in Google Reviews.
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" aria-hidden />
              Auto-copy wasn't allowed by your browser.
            </>
          )}
        </div>
      )}

      {/* Manual copy button */}
      <Button
        variant={copied ? 'success' : 'secondary'}
        fullWidth
        icon={copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        onClick={handleManualCopy}
        aria-label={copied ? 'Review copied' : 'Tap to copy review'}
      >
        {copied ? 'Copied ✓' : 'Tap to Copy Review'}
      </Button>

      {/* Google Review CTA */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        icon={<ExternalLink className="h-5 w-5" />}
        iconPosition="right"
        onClick={handleOpenReview}
        aria-label="Open Google Reviews in a new tab"
      >
        Leave a Google Review
      </Button>

      {/* Post-click completion */}
      {reviewOpened && (
        <div className="space-y-2">
          <p className="text-center text-xs text-slate-500">Done posting? Let us know!</p>
          <Button
            variant="success"
            fullWidth
            icon={<CheckCircle className="h-4 w-4" />}
            onClick={handleCompleted}
          >
            Feedback completed
          </Button>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center pb-2">
        Your personal information is never shared publicly.
      </p>
    </div>
  );
}
