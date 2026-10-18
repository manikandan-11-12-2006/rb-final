import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  ChevronRight,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  BarChart3,
  ShieldAlert,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Input, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { StarRating } from '../../components/ui/StarRating';
import { ReviewStatusBadge, FollowUpBadge } from '../../components/ui/StatusIndicator';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { getFeedback, deleteFeedback, deleteAllFeedback } from '../../services/feedbackService';
import type { Feedback, SentimentType } from '../../types/feedback';
import { formatDate } from '../../utils/formatters';

const ratingOptions = [
  { value: 'all', label: 'All Ratings' },
  { value: '5', label: '5 Stars' },
  { value: '4', label: '4 Stars' },
  { value: '3', label: '3 Stars' },
  { value: '2', label: '2 Stars' },
  { value: '1', label: '1 Star' },
];

const sentimentOptions = [
  { value: 'all', label: 'All Sentiments' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
];

const statusOptions = [
  { value: 'all', label: 'All Statuses' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'review_ready', label: 'Review Ready' },
  { value: 'redirected', label: 'Redirected' },
  { value: 'completed', label: 'Completed' },
  { value: 'follow_up_required', label: 'Follow-up Required' },
];

export default function FeedbackList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentHospital } = useAuth();

  const [search, setSearch] = useState('');
  const [rating, setRating] = useState('all');
  const [sentiment, setSentiment] = useState('all');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'all');
  const [rawFeedbacks, setRawFeedbacks] = useState<Feedback[]>([]);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  // Delete states
  const [feedbackToDelete, setFeedbackToDelete] = useState<Feedback | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load all feedback for the clinic
  const load = useCallback(() => {
    setLoading(true);
    getFeedback({
      hospitalId: currentHospital?.id,
    })
      .then((data) => {
        setRawFeedbacks(data);
      })
      .finally(() => setLoading(false));
  }, [currentHospital?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteParticular = async () => {
    if (!feedbackToDelete) return;
    setIsDeleting(true);
    try {
      await deleteFeedback(feedbackToDelete.id);
      setRawFeedbacks((prev) => prev.filter((f) => f.id !== feedbackToDelete.id));
      setFeedbackList((prev) => prev.filter((f) => f.id !== feedbackToDelete.id));
      setFeedbackToDelete(null);
    } catch (err) {
      console.error('Failed to delete feedback:', err);
      alert('Failed to delete review. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await deleteAllFeedback(currentHospital?.id);
      setRawFeedbacks([]);
      setFeedbackList([]);
      setShowDeleteAllModal(false);
    } catch (err) {
      console.error('Failed to delete all feedback:', err);
      alert('Failed to delete all reviews. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Apply filters locally in real-time
  useEffect(() => {
    let filtered = [...rawFeedbacks];

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.patientName.toLowerCase().includes(q) ||
          f.visitId.toLowerCase().includes(q) ||
          (f.phone && f.phone.includes(q)) ||
          (f.originalFeedback && f.originalFeedback.toLowerCase().includes(q)) ||
          (f.healthcareTopic && f.healthcareTopic.toLowerCase().includes(q))
      );
    }

    if (rating !== 'all') {
      const r = parseInt(rating, 10);
      filtered = filtered.filter((f) => f.rating === r);
    }

    if (sentiment !== 'all') {
      filtered = filtered.filter((f) => f.sentiment === sentiment);
    }

    if (status !== 'all') {
      filtered = filtered.filter((f) => f.reviewStatus === status);
    }

    setFeedbackList(filtered);
  }, [rawFeedbacks, search, rating, sentiment, status]);

  // Sentiment Counts & Percentages
  const totalCount = rawFeedbacks.length;
  const positiveCount = rawFeedbacks.filter((f) => f.sentiment === 'positive').length;
  const neutralCount = rawFeedbacks.filter((f) => f.sentiment === 'neutral').length;
  const negativeCount = rawFeedbacks.filter((f) => f.sentiment === 'negative').length;

  const posPct = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;
  const neuPct = totalCount > 0 ? Math.round((neutralCount / totalCount) * 100) : 0;
  const negPct = totalCount > 0 ? Math.round((negativeCount / totalCount) * 100) : 0;

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reviews & Patient Feedback</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Genuine patient feedback analyzed with word-level NLP tokenization, aspect modeling, and sentiment scoring.
          </p>
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteAllModal(true)}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 font-semibold flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Trash2 className="h-4 w-4 text-rose-500" />
              <span>Delete All Reviews</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── 3 Executive Cards matching Clinical Dashboard Style ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: All Reviews */}
        <div
          onClick={() => setSentiment('all')}
          className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all duration-300 relative flex flex-col justify-between hover:shadow-md ${
            sentiment === 'all'
              ? 'border-blue-400 ring-2 ring-blue-500/20 shadow-md bg-gradient-to-b from-blue-50/20 to-white'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                ALL REVIEWS
              </span>
            </div>

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Total Reviews
            </p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{totalCount}</p>

            <div className="mt-3.5 bg-blue-50/60 border border-blue-100/80 rounded-lg px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-xs font-medium text-blue-900">
                All patient reviews recorded
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex gap-1 mb-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-1.5 flex-1 rounded-full bg-blue-600" />
              ))}
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Pipeline Total</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                100% recorded
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Positive Reviews */}
        <div
          onClick={() => setSentiment('positive')}
          className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all duration-300 relative flex flex-col justify-between hover:shadow-md ${
            sentiment === 'positive'
              ? 'border-emerald-400 ring-2 ring-emerald-500/20 shadow-md bg-gradient-to-b from-emerald-50/20 to-white'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                POSITIVE NLP
              </span>
            </div>

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Positive Feedback
            </p>
            <p className="text-3xl font-extrabold text-emerald-950 mt-1">{positiveCount}</p>

            <div className="mt-3.5 bg-emerald-50/60 border border-emerald-100/80 rounded-lg px-3 py-2 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-xs font-medium text-emerald-900">
                High satisfaction & praise
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex gap-1 mb-2">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < Math.round((positiveCount / (totalCount || 1)) * 10)
                      ? 'bg-emerald-500'
                      : 'bg-slate-100'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Positive Rate</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                {posPct}% positive
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Negative Reviews */}
        <div
          onClick={() => setSentiment('negative')}
          className={`bg-white border rounded-2xl p-5 cursor-pointer transition-all duration-300 relative flex flex-col justify-between hover:shadow-md ${
            sentiment === 'negative'
              ? 'border-rose-400 ring-2 ring-rose-500/20 shadow-md bg-gradient-to-b from-rose-50/20 to-white'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-md">
                ACTION REQUIRED
              </span>
            </div>

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Negative Feedback
            </p>
            <p className="text-3xl font-extrabold text-rose-950 mt-1">{negativeCount}</p>

            <div className="mt-3.5 bg-rose-50/60 border border-rose-100/80 rounded-lg px-3 py-2 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="text-xs font-medium text-rose-900">
                Hospital action plan generated
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex gap-1 mb-2">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < Math.round((negativeCount / (totalCount || 1)) * 10)
                      ? 'bg-rose-500'
                      : 'bg-slate-100'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Issue Rate</span>
              <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                {negPct}% action
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by patient name, keyword, or topic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              aria-label="Search feedback"
            />
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            <Select
              options={sentimentOptions}
              value={sentiment}
              onChange={(e) => setSentiment(e.target.value)}
              aria-label="Filter by sentiment"
            />
            <Select
              options={ratingOptions}
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              aria-label="Filter by rating"
            />
            <Select
              options={statusOptions}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            />
          </div>
        </div>
      </Card>

      {/* Results Table */}
      <Card padding="none">
        {loading ? (
          <PageSpinner message="Loading feedback and NLP sentiment analysis…" />
        ) : feedbackList.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-10 w-10 text-primary-500" />}
            title="No Matching Patient Reviews"
            description="No reviews found matching the selected sentiment or search criteria."
          />
        ) : (
          <>
            {/* Desktop header */}
            <div
              className="hidden lg:grid gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wide rounded-t-xl"
              style={{ gridTemplateColumns: '2fr 1fr 1fr 2.5fr 1.2fr 1.2fr 1.2fr 80px' }}
            >
              <span>Patient</span>
              <span>Visit Date</span>
              <span>Rating</span>
              <span>Feedback & Aspect</span>
              <span>AI Sentiment</span>
              <span>Review Status</span>
              <span>Follow-up</span>
              <span className="text-right">Actions</span>
            </div>

            <ul className="divide-y divide-slate-100">
              {feedbackList.map((fb) => (
                <li key={fb.id}>
                  {/* Desktop row */}
                  <div
                    className="hidden lg:grid gap-4 items-center px-5 py-3.5 hover:bg-slate-50/80 transition-colors"
                    style={{ gridTemplateColumns: '2fr 1fr 1fr 2.5fr 1.2fr 1.2fr 1.2fr 80px' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-semibold shrink-0">
                        {fb.patientName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{fb.patientName}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{fb.phone || fb.maskedPhone}</p>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600">{formatDate(fb.visitDate)}</p>

                    <StarRating value={fb.rating} readonly size="sm" />

                    <div className="min-w-0">
                      <p className="text-sm text-slate-800 truncate italic">
                        {fb.originalFeedback ?? 'No text feedback'}
                      </p>
                      {fb.healthcareTopic && (
                        <span className="inline-block mt-1 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {fb.healthcareTopic}
                        </span>
                      )}
                    </div>

                    <div>{renderSentimentBadge(fb.sentiment)}</div>

                    <ReviewStatusBadge status={fb.reviewStatus} />

                    <FollowUpBadge status={fb.followUpStatus} />

                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Delete this review"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFeedbackToDelete(fb);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        aria-label={`Delete review for ${fb.patientName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ChevronRight className="h-4 w-4" />}
                        onClick={() => navigate(`/staff/feedback/${fb.id}`)}
                        aria-label={`View details for ${fb.patientName}`}
                      />
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="lg:hidden relative border-b border-slate-100 last:border-b-0">
                    <button
                      className="w-full flex items-start gap-4 px-4 py-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                      onClick={() => navigate(`/staff/feedback/${fb.id}`)}
                      aria-label={`View feedback from ${fb.patientName}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-semibold shrink-0">
                        {fb.patientName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0 pr-12">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{fb.patientName}</p>
                            <p className="text-xs text-slate-500 font-mono">{fb.phone || fb.maskedPhone}</p>
                          </div>
                          <StarRating value={fb.rating} readonly size="sm" />
                        </div>
                        <p className="text-xs text-slate-700 mt-1 truncate italic">
                          {fb.originalFeedback ?? 'No text feedback provided.'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {renderSentimentBadge(fb.sentiment)}
                          {fb.healthcareTopic && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                              {fb.healthcareTopic}
                            </span>
                          )}
                          <ReviewStatusBadge status={fb.reviewStatus} />
                          {fb.followUpStatus !== 'none' && <FollowUpBadge status={fb.followUpStatus} />}
                        </div>
                      </div>
                    </button>
                    <div className="absolute right-3 top-4 flex items-center gap-1">
                      <button
                        type="button"
                        title="Delete this review"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFeedbackToDelete(fb);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        aria-label={`Delete review for ${fb.patientName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80 rounded-b-xl flex justify-between items-center text-xs text-slate-500">
              <span>
                Showing {feedbackList.length} of {totalCount} reviews
              </span>
              <span>
                Filters: {sentiment !== 'all' ? `Sentiment: ${sentiment}` : 'All Sentiments'}
              </span>
            </div>
          </>
        )}
      </Card>

      {/* Modal: Delete Particular Review */}
      {feedbackToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Patient Feedback</h3>
                <p className="text-xs text-slate-500">Permanently delete this specific feedback</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-800">{feedbackToDelete.patientName}</span>
                <span className="text-slate-500">{formatDate(feedbackToDelete.visitDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <StarRating value={feedbackToDelete.rating} readonly size="sm" />
                <span className="text-slate-400">•</span>
                <span className="font-mono text-slate-500">{feedbackToDelete.phone || feedbackToDelete.maskedPhone}</span>
              </div>
              {feedbackToDelete.originalFeedback && (
                <p className="italic text-slate-600 line-clamp-2 pt-1 border-t border-slate-200/60">
                  "{feedbackToDelete.originalFeedback}"
                </p>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to delete this feedback record? This action will remove the review from the system and cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={isDeleting}
                onClick={() => setFeedbackToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteParticular}
                className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Feedback</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete All Reviews */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete All Reviews & Feedback</h3>
                <p className="text-xs text-slate-500">Permanent action for this clinic</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed bg-rose-50 border border-rose-200/60 rounded-xl p-3.5 space-y-1.5">
              <p className="font-semibold text-rose-800">⚠️ Warning: Permanent Data Deletion</p>
              <p>
                Are you sure you want to delete <strong>all {totalCount} reviews and feedback records</strong>? This will permanently wipe all review submissions, reset ratings, and update the review funnel.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={isDeleting}
                onClick={() => setShowDeleteAllModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteAll}
                className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting All...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Yes, Delete All Reviews</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
