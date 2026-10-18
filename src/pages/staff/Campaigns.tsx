import React, { useEffect, useState } from 'react';
import { Megaphone, Info, Clock } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { PageSpinner } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { getCampaigns } from '../../services/campaignService';
import type { Campaign, ReminderStatus } from '../../types/campaign';
import { formatDate, formatDateTime } from '../../utils/formatters';

// ---------------------------------------------------------------------------
// Reminder status badge
// ---------------------------------------------------------------------------
const reminderVariant: Record<ReminderStatus, 'success' | 'info' | 'neutral' | 'warning'> = {
  completed: 'success',
  sent: 'info',
  scheduled: 'neutral',
  skipped: 'warning',
};

function ReminderBadge({ status, sentAt }: { status: ReminderStatus; sentAt?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={reminderVariant[status]} dot>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
      {sentAt && (
        <span className="text-xs text-slate-400 pl-1">{formatDateTime(sentAt)}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCampaigns()
      .then(setCampaigns)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner message="Loading campaigns…" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Campaigns</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Reminder schedule monitoring. Actual reminders are sent via Make automation.
        </p>
      </div>

      {/* Simulation notice */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-blue-800">Simulated data</p>
          <p className="text-xs text-blue-600 mt-0.5">
            The Day 3 and Day 10 reminders shown here are currently simulated. In production, Make.com
            automation handles delivery via WhatsApp Business API. This view displays status received
            from the backend.
          </p>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="No campaigns yet"
          description="Campaigns will appear here once patients are enrolled."
        />
      ) : (
        campaigns.map((campaign) => (
          <div key={campaign.id} className="space-y-4">
            {/* Campaign summary card */}
            <Card>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{campaign.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Started {formatDate(campaign.startDate)} · {campaign.totalPatients} patients enrolled
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900">{campaign.responded}</p>
                    <p className="text-xs text-slate-500">Responded</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900">
                      {campaign.totalPatients - campaign.responded}
                    </p>
                    <p className="text-xs text-slate-500">Pending</p>
                  </div>
                  <Badge
                    variant={
                      campaign.status === 'active'
                        ? 'success'
                        : campaign.status === 'paused'
                        ? 'warning'
                        : 'neutral'
                    }
                    dot
                  >
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </Badge>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Response rate</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {Math.round((campaign.responded / campaign.totalPatients) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${(campaign.responded / campaign.totalPatients) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={campaign.responded}
                    aria-valuemin={0}
                    aria-valuemax={campaign.totalPatients}
                    aria-label={`${campaign.responded} of ${campaign.totalPatients} patients responded`}
                  />
                </div>
              </div>
            </Card>

            {/* Reminder schedule table */}
            <Card padding="none">
              <div className="px-5 py-4 border-b border-slate-100">
                <CardHeader
                  title="Reminder Schedule"
                  subtitle="Day 3 and Day 10 follow-up reminders"
                />
              </div>

              {/* Desktop header */}
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1.5fr_1.5fr] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <span>Patient</span>
                <span>Visit Date</span>
                <span>Feedback</span>
                <span>Day 3 Reminder</span>
                <span>Day 10 Reminder</span>
              </div>

              <ul className="divide-y divide-slate-100">
                {campaign.reminders.map((r, i) => (
                  <li key={i} className="px-5 py-4">
                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1.5fr_1.5fr] gap-4 items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{r.patientName}</p>
                        <p className="text-xs text-slate-400">{r.maskedPhone}</p>
                      </div>
                      <p className="text-sm text-slate-600">{formatDate(r.visitDate)}</p>
                      <Badge variant={r.feedbackStatus === 'completed' ? 'success' : 'warning'} dot>
                        {r.feedbackStatus === 'completed' ? 'Completed' : 'Pending'}
                      </Badge>
                      <ReminderBadge status={r.day3Status} sentAt={r.day3SentAt} />
                      <ReminderBadge status={r.day10Status} sentAt={r.day10SentAt} />
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{r.patientName}</p>
                          <p className="text-xs text-slate-400">{r.maskedPhone} · {formatDate(r.visitDate)}</p>
                        </div>
                        <Badge variant={r.feedbackStatus === 'completed' ? 'success' : 'warning'} dot>
                          {r.feedbackStatus === 'completed' ? 'Responded' : 'Pending'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" aria-hidden />
                          <span className="text-xs text-slate-500">Day 3:</span>
                          <ReminderBadge status={r.day3Status} sentAt={r.day3SentAt} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-400" aria-hidden />
                          <span className="text-xs text-slate-500">Day 10:</span>
                          <ReminderBadge status={r.day10Status} sentAt={r.day10SentAt} />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}
