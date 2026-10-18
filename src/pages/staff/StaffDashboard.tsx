import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Send, MessageSquare, Star, AlertTriangle,
  TrendingUp, ArrowRight, Clock, ChevronRight,
  Activity, BarChart3, CheckCircle2, XCircle,
} from 'lucide-react';
import { getFeedbackStats, getFeedback } from '../../services/feedbackService';
import type { FeedbackStats, Feedback } from '../../types/feedback';
import { formatDate, relativeTime } from '../../utils/formatters';
import { ReviewStatusBadge } from '../../components/ui/StatusIndicator';
import { StarRating } from '../../components/ui/StarRating';
import { PageSpinner } from '../../components/ui/Spinner';

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------
interface KpiProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  trend?: number;
  accent: string;   // Tailwind text colour
  bg: string;       // Tailwind bg colour
}

function KpiCard({ label, value, sub, icon, trend, accent, bg }: KpiProps) {
  return (
    <div className="bg-white border border-surface-border rounded-xl shadow-card px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide">{label}</p>
        <span className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center ${accent}`}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-2xl font-black text-ink-DEFAULT">{value}</p>
        {sub && <p className="text-xs text-ink-subtle mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-primary-600' : 'text-red-500'}`}>
          <TrendingUp className="h-3 w-3" aria-hidden />
          {trend >= 0 ? '+' : ''}{trend}% vs last month
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------
function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-bold text-ink-DEFAULT">{title}</h2>
        {sub && <p className="text-xs text-ink-subtle mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rating dot
// ---------------------------------------------------------------------------
function RatingDot({ rating }: { rating: number }) {
  const color = rating >= 4 ? 'bg-primary-500' : rating === 3 ? 'bg-amber-400' : 'bg-red-400';
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} aria-hidden />;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export default function StaffDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [recent, setRecent] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFeedbackStats(), getFeedback()])
      .then(([s, f]) => { setStats(s); setRecent(f.slice(0, 6)); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner message="Loading dashboard…" />;
  if (!stats) return null;

  const kpis: KpiProps[] = [
    {
      label: 'Total Visits',
      value: stats.totalVisits.toLocaleString(),
      icon: <Users className="h-4 w-4" aria-hidden />,
      trend: 4.2,
      accent: 'text-primary-600',
      bg: 'bg-primary-50',
    },
    {
      label: 'Requests Sent',
      value: stats.requestsSent.toLocaleString(),
      icon: <Send className="h-4 w-4" aria-hidden />,
      trend: 3.8,
      accent: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Responses',
      value: stats.responsesReceived.toLocaleString(),
      sub: `${stats.responseRate}% response rate`,
      icon: <MessageSquare className="h-4 w-4" aria-hidden />,
      trend: 6.1,
      accent: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      label: 'Google Reviews',
      value: stats.googleReviewsCompleted.toLocaleString(),
      sub: `${stats.conversionRate}% conversion`,
      icon: <Star className="h-4 w-4" aria-hidden />,
      trend: 8.4,
      accent: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Follow-ups Needed',
      value: stats.followUpsRequired,
      icon: <AlertTriangle className="h-4 w-4" aria-hidden />,
      trend: -2.1,
      accent: 'text-red-600',
      bg: 'bg-red-50',
    },
  ];

  // Simple conversion funnel
  const funnelSteps = [
    { label: 'Visits',       value: stats.totalVisits,              pct: 100 },
    { label: 'Requests',     value: stats.requestsSent,             pct: Math.round((stats.requestsSent / stats.totalVisits) * 100) },
    { label: 'Responses',    value: stats.responsesReceived,        pct: Math.round((stats.responsesReceived / stats.totalVisits) * 100) },
    { label: 'Reviews',      value: stats.googleReviewsCompleted,   pct: Math.round((stats.googleReviewsCompleted / stats.totalVisits) * 100) },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-ink-DEFAULT">Dashboard</h1>
          <p className="text-sm text-ink-subtle mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/desk')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl shadow-card transition-colors"
        >
          <Activity className="h-4 w-4" aria-hidden /> Automation Desk
        </button>
      </div>

      {/* Follow-up alert */}
      {stats.followUpsRequired > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" aria-hidden />
          <p className="text-sm text-red-800 flex-1">
            <span className="font-bold">{stats.followUpsRequired} patients</span> submitted low ratings and require follow-up.
          </p>
          <button
            onClick={() => navigate('/staff/feedback?status=follow_up_required')}
            className="text-xs font-semibold text-red-700 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
          >
            Review →
          </button>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recent feedback — spans 2 cols */}
        <div className="lg:col-span-2 bg-white border border-surface-border rounded-xl shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border">
            <SectionHeader
              title="Recent Feedback"
              sub="Latest patient submissions"
              action={
                <button
                  onClick={() => navigate('/staff/feedback')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  View all <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              }
            />
          </div>
          <ul className="divide-y divide-surface-border">
            {recent.map((fb) => (
              <li key={fb.id}>
                <button
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                  onClick={() => navigate(`/staff/feedback/${fb.id}`)}
                  aria-label={`Open feedback from ${fb.patientName}`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center shrink-0">
                    {fb.patientName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink-DEFAULT truncate">{fb.patientName}</p>
                      <RatingDot rating={fb.rating} />
                      <span className="text-xs text-ink-subtle">{fb.rating}/5</span>
                    </div>
                    <p className="text-xs text-ink-subtle truncate mt-0.5">
                      {fb.originalFeedback ?? 'No text feedback provided.'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <ReviewStatusBadge status={fb.reviewStatus} />
                    <span className="text-[11px] text-ink-subtle flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden />
                      {fb.feedbackSubmittedAt ? relativeTime(fb.feedbackSubmittedAt) : formatDate(fb.visitDate)}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-subtle shrink-0" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Funnel + integrations */}
        <div className="space-y-4">
          {/* Conversion funnel */}
          <div className="bg-white border border-surface-border rounded-xl shadow-card p-5">
            <SectionHeader title="Conversion Funnel" sub="This month" />
            <div className="space-y-2.5">
              {funnelSteps.map((step) => (
                <div key={step.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-ink-muted">{step.label}</span>
                    <span className="text-xs font-bold text-ink-DEFAULT">{step.value.toLocaleString()} <span className="text-ink-subtle font-normal">({step.pct}%)</span></span>
                  </div>
                  <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${step.pct}%` }}
                      role="progressbar"
                      aria-valuenow={step.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Integration status */}
          <div className="bg-white border border-surface-border rounded-xl shadow-card p-5">
            <SectionHeader title="Integrations" />
            <div className="space-y-2">
              {[
                { name: 'WhatsApp Business', status: 'Not connected',       ok: false },
                { name: 'Google Reviews',    status: 'URL configured',      ok: true  },
                { name: 'Supabase Database', status: 'Connected',           ok: true  },
              ].map(({ name, status, ok }) => (
                <div key={name} className="flex items-center justify-between py-1.5 border-b border-surface-border last:border-0">
                  <div className="flex items-center gap-2">
                    {ok
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-primary-500 shrink-0" aria-hidden />
                      : <XCircle className="h-3.5 w-3.5 text-ink-subtle shrink-0" aria-hidden />}
                    <span className="text-xs font-medium text-ink-soft">{name}</span>
                  </div>
                  <span className={`text-[11px] font-medium ${ok ? 'text-primary-600' : 'text-ink-subtle'}`}>{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
