import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  Calendar,
  Hash,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Copy,
  ExternalLink,
  MessageSquare,
  Mic,
  Send,
  Lightbulb,
  HeartHandshake,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StarRating } from '../../components/ui/StarRating';
import { Timeline } from '../../components/ui/Timeline';
import type { TimelineStep } from '../../components/ui/Timeline';
import { ReviewStatusBadge, FollowUpBadge } from '../../components/ui/StatusIndicator';
import { PageSpinner } from '../../components/ui/Spinner';
import { ToastContainer } from '../../components/ui/Toast';
import { useToast } from '../../hooks/useToast';
import { useClipboard } from '../../hooks/useClipboard';
import { getFeedbackById, updateFollowUpStatus, deleteFeedback } from '../../services/feedbackService';
import { getPatientResponseMessage } from '../../services/sentimentAnalysisService';
import type { Feedback, FollowUpStatus, SentimentType } from '../../types/feedback';
import { formatDate, formatDateTime } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Build timeline from a feedback record
// ---------------------------------------------------------------------------
function buildTimeline(fb: Feedback): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      label: 'Visit completed',
      timestamp: formatDate(fb.visitDate),
      status: 'completed',
    },
    {
      label: 'WhatsApp message sent',
      timestamp: fb.whatsappSentAt ? formatDateTime(fb.whatsappSentAt) : undefined,
      status: fb.whatsappSentAt ? 'completed' : 'pending',
    },
    {
      label: 'Feedback received',
      timestamp: fb.feedbackSubmittedAt ? formatDateTime(fb.feedbackSubmittedAt) : undefined,
      status: fb.feedbackSubmittedAt ? 'completed' : 'pending',
    },
  ];

  if (fb.rating >= 4) {
    steps.push({
      label: 'AI review prepared',
      status: fb.cleanedReview ? 'completed' : fb.feedbackSubmittedAt ? 'current' : 'pending',
      description: fb.cleanedReview ? 'Review text generated' : undefined,
    });
    steps.push({
      label: 'Review link opened',
      timestamp: fb.reviewOpenedAt ? formatDateTime(fb.reviewOpenedAt) : undefined,
      status: fb.reviewOpenedAt ? 'completed' : 'pending',
    });
    steps.push({
      label: 'Google review completed',
      timestamp: fb.reviewCompletedAt ? formatDateTime(fb.reviewCompletedAt) : undefined,
      status: fb.reviewCompletedAt ? 'completed' : 'pending',
    });
  } else {
    steps.push({
      label: 'Staff follow-up required',
      status: fb.feedbackSubmittedAt ? 'current' : 'pending',
      description: 'Low/Neutral rating — no Google review redirection.',
    });
    steps.push({
      label: 'Follow-up resolved',
      status: fb.followUpStatus === 'resolved' ? 'completed' : 'pending',
    });
  }

  return steps;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default function FeedbackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, addToast, removeToast } = useToast();
  const { copy } = useClipboard();

  const [fb, setFb] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingFollowUp, setUpdatingFollowUp] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!fb) return;
    setIsDeleting(true);
    try {
      await deleteFeedback(fb.id);
      addToast('Review deleted successfully', 'success');
      setTimeout(() => {
        navigate('/staff/feedback');
      }, 500);
    } catch (err) {
      console.error('Failed to delete review:', err);
      addToast('Failed to delete review', 'error');
      setIsDeleting(false);
    }
  };

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    getFeedbackById(id)
      .then(setFb)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFollowUp = async (status: FollowUpStatus) => {
    if (!id || !fb) return;
    setUpdatingFollowUp(true);
    const ok = await updateFollowUpStatus(id, status);
    setUpdatingFollowUp(false);
    if (ok) {
      setFb({ ...fb, followUpStatus: status });
      addToast(`Follow-up marked as ${status}`, 'success');
    }
  };

  const handleCopyReview = async () => {
    if (!fb?.cleanedReview) return;
    const ok = await copy(fb.cleanedReview);
    addToast(
      ok ? 'Review text copied to clipboard' : 'Copy failed — please select the text manually',
      ok ? 'success' : 'warning'
    );
  };

  const handleCopySolution = async () => {
    if (!fb?.aiSuggestedSolution) return;
    const ok = await copy(fb.aiSuggestedSolution);
    addToast(
      ok ? 'AI corrective solution copied to clipboard' : 'Copy failed',
      ok ? 'success' : 'warning'
    );
  };

  if (loading) return <PageSpinner message="Loading feedback and AI analysis…" />;

  if (!fb) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Feedback record not found.</p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  const isPositive = fb.sentiment === 'positive' || (fb.rating >= 4 && fb.sentiment !== 'negative');
  const isNegativeOrNeutral = !isPositive;
  const isLowRating = fb.rating <= 3;
  const timeline = buildTimeline(fb);

  const sentimentKey: SentimentType = fb.sentiment || (fb.rating >= 4 ? 'positive' : fb.rating <= 2 ? 'negative' : 'neutral');
  const patientResponseText = getPatientResponseMessage(
    sentimentKey,
    fb.patientName,
    'Tambaram Medical Center'
  );

  const handleSendWhatsAppResponse = () => {
    const rawPhone = fb.phone || fb.maskedPhone || '';
    const digits = rawPhone.replace(/\D/g, '');
    if (!digits) {
      addToast('No valid phone number found for this patient', 'warning');
      return;
    }
    const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(patientResponseText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    addToast('WhatsApp opened with tailored sentiment response!', 'success');
  };

  const handleCopyResponse = async () => {
    const ok = await copy(patientResponseText);
    addToast(
      ok ? 'Patient WhatsApp response copied to clipboard' : 'Copy failed',
      ok ? 'success' : 'warning'
    );
  };

  const renderSentimentBadge = (sent?: SentimentType) => {
    switch (sent) {
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Positive
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Negative
          </span>
        );
      case 'neutral':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Neutral
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Back + status */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
        <div className="flex-1" />
        {renderSentimentBadge(fb.sentiment)}
        <ReviewStatusBadge status={fb.reviewStatus} />
        <Button
          variant="secondary"
          size="sm"
          icon={<Trash2 className="h-4 w-4 text-rose-500" />}
          onClick={() => setShowDeleteModal(true)}
          className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 cursor-pointer"
        >
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Patient info */}
          <Card>
            <CardHeader title="Patient Information" className="mb-4" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { icon: <Hash className="h-4 w-4 text-slate-400" />, label: 'Visit ID', value: fb.visitId },
                { icon: <Calendar className="h-4 w-4 text-slate-400" />, label: 'Visit Date', value: formatDate(fb.visitDate) },
                { icon: <Phone className="h-4 w-4 text-slate-400" />, label: 'Phone', value: fb.phone || fb.maskedPhone },
                {
                  icon: <MessageSquare className="h-4 w-4 text-slate-400" />,
                  label: 'Channel',
                  value: (
                    <Badge variant={fb.channel === 'whatsapp' ? 'info' : 'neutral'}>
                      {fb.channel === 'whatsapp' ? 'WhatsApp' : 'Web'}
                    </Badge>
                  ),
                },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="mt-0.5">{icon}</span>
                  <div>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-sm font-medium text-slate-900 mt-0.5">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </Card>

          {/* Rating + feedback */}
          <Card>
            <CardHeader title="Feedback" className="mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <StarRating value={fb.rating} readonly size="lg" />
              <span className="text-2xl font-bold text-slate-900">
                {fb.rating}
                <span className="text-base font-normal text-slate-400">/5</span>
              </span>
              {fb.feedbackType === 'voice' && (
                <Badge variant="info">
                  <Mic className="h-3 w-3 inline mr-1" aria-hidden />
                  Voice
                </Badge>
              )}
              {fb.healthcareTopic && (
                <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-md font-semibold">
                  {fb.healthcareTopic}
                </span>
              )}
            </div>

            {fb.originalFeedback ? (
              <div className="bg-slate-50 rounded-lg px-4 py-3 mb-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Original Feedback
                </p>
                <p className="text-sm text-slate-700 italic">"{fb.originalFeedback}"</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic mb-4">No text feedback provided.</p>
            )}

            {isPositive && fb.cleanedReview && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary-600" aria-hidden />
                    <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
                      AI-Prepared Review
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Copy className="h-3.5 w-3.5" />}
                    onClick={handleCopyReview}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-primary-900 italic">"{fb.cleanedReview}"</p>
                <p className="text-xs text-primary-600 mt-2">
                  AI-generated text preserves the patient's compliment for 5-star Google Review publication.
                </p>
              </div>
            )}
          </Card>

          {/* ── DEDICATED SENTIMENT-BASED WHATSAPP PATIENT RESPONSE CARD ── */}
          <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-slate-50 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Send className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    WhatsApp Patient Response
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full capitalize">
                      {sentimentKey} Feedback
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sentimentKey === 'positive'
                      ? 'Gratitude & thank you message for 5★ satisfied patient'
                      : sentimentKey === 'neutral'
                      ? 'Service acknowledgement & improvement assurance message'
                      : 'Apology & corrective resolution response message'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy className="h-3.5 w-3.5" />}
                  onClick={handleCopyResponse}
                  className="text-slate-600 hover:bg-slate-100"
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-3.5 mb-3 text-sm text-slate-800 whitespace-pre-line leading-relaxed font-mono text-xs">
              {patientResponseText}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-slate-500">
                Patient Phone: <strong className="text-slate-800">{fb.phone || fb.maskedPhone}</strong>
              </span>

              <Button
                variant="primary"
                size="sm"
                icon={<Send className="h-3.5 w-3.5" />}
                onClick={handleSendWhatsAppResponse}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {sentimentKey === 'positive'
                  ? 'Send Gratitude via WhatsApp'
                  : sentimentKey === 'neutral'
                  ? 'Send Acknowledgement via WhatsApp'
                  : 'Send Apology via WhatsApp'}
              </Button>
            </div>
          </Card>

          {/* ── AI CORRECTIVE SOLUTION & ACTION PLAN FOR NEGATIVE & NEUTRAL FEEDBACK ── */}
          {isNegativeOrNeutral && (
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                      AI Corrective Solution & Hospital Action Plan
                    </h3>
                    <p className="text-xs text-indigo-600 mt-0.5">
                      Tailored resolution generated for {fb.healthcareTopic || 'Hospital Experience'}
                    </p>
                  </div>
                </div>

                {fb.aiSuggestedSolution && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Copy className="h-3.5 w-3.5" />}
                    onClick={handleCopySolution}
                    className="text-indigo-700 hover:bg-indigo-100 shrink-0"
                  >
                    Copy Solution
                  </Button>
                )}
              </div>

              <div className="bg-white/90 border border-indigo-100 rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Recommended Action Steps for Staff & Management:
                  </span>
                </div>
                <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed pl-1 font-normal">
                  {fb.aiSuggestedSolution ||
                    '1. Contact the patient within 24 hours to address their concerns.\n2. Review department workflow with the nursing/administrative supervisor.\n3. Log follow-up resolution in the clinic quality assurance registry.'}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs text-indigo-700">
                <span>Model: CardiffNLP RoBERTa + Groq AI Clinical Resolution</span>
                <span className="font-semibold text-emerald-700">Actionable Plan Ready</span>
              </div>
            </Card>
          )}

          {/* Low rating follow-up controls */}
          {isLowRating && (
            <Card className="border-red-200 bg-red-50">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" aria-hidden />
                <div>
                  <h3 className="text-sm font-semibold text-red-800">Follow-up Required</h3>
                  <p className="text-sm text-red-600 mt-1">
                    Patient submitted a {fb.rating}-star rating. This feedback is handled internally
                    — no Google review redirection is shown to this patient.
                  </p>
                </div>
              </div>
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1.5">Current status</p>
                <FollowUpBadge status={fb.followUpStatus} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={updatingFollowUp}
                  disabled={fb.followUpStatus === 'contacted' || fb.followUpStatus === 'resolved'}
                  onClick={() => handleFollowUp('contacted')}
                >
                  Mark as Contacted
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  icon={<CheckCircle className="h-4 w-4" />}
                  loading={updatingFollowUp}
                  disabled={fb.followUpStatus === 'resolved'}
                  onClick={() => handleFollowUp('resolved')}
                >
                  Mark as Resolved
                </Button>
              </div>
            </Card>
          )}

          {/* Positive review info */}
          {isPositive && (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <HeartHandshake className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-900">
                    Patient Satisfaction Confirmed
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    No corrective solution needed. Patient reported a positive experience and was routed to 5-star Google Reviews.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right column — timeline + statuses */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Journey Timeline" className="mb-5" />
            <Timeline steps={timeline} />
          </Card>

          <Card>
            <CardHeader title="Statuses & AI Insights" className="mb-4" />
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-slate-500 mb-1">AI Sentiment</dt>
                <dd>{renderSentimentBadge(fb.sentiment)}</dd>
              </div>
              {fb.healthcareTopic && (
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Aspect Topic</dt>
                  <dd>
                    <span className="text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                      {fb.healthcareTopic}
                    </span>
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-500 mb-1">Review Status</dt>
                <dd><ReviewStatusBadge status={fb.reviewStatus} /></dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 mb-1">Follow-up Status</dt>
                <dd><FollowUpBadge status={fb.followUpStatus} /></dd>
              </div>
              {fb.feedbackSubmittedAt && (
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Submitted</dt>
                  <dd className="text-sm text-slate-700">{formatDateTime(fb.feedbackSubmittedAt)}</dd>
                </div>
              )}
              {fb.reviewCompletedAt && (
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Review completed</dt>
                  <dd className="text-sm text-slate-700">{formatDateTime(fb.reviewCompletedAt)}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Feedback Record</h3>
                <p className="text-xs text-slate-500">Permanently remove this review</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              Are you sure you want to permanently delete the feedback record for <strong>{fb.patientName}</strong>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeleting}
                onClick={handleDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Review'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
