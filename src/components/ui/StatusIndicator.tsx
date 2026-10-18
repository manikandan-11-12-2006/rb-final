import React from 'react';
import { Badge } from './Badge';
import type { ReviewStatus, FollowUpStatus } from '../../types/feedback';

// ---------------------------------------------------------------------------
// Review status badge
// ---------------------------------------------------------------------------
const reviewStatusConfig: Record<
  ReviewStatus,
  { label: string; variant: Parameters<typeof Badge>[0]['variant'] }
> = {
  not_started: { label: 'Not Started', variant: 'neutral' },
  review_ready: { label: 'Review Ready', variant: 'info' },
  redirected: { label: 'Redirected', variant: 'default' },
  completed: { label: 'Completed', variant: 'success' },
  follow_up_required: { label: 'Follow-up Required', variant: 'danger' },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = reviewStatusConfig[status];
  return (
    <Badge variant={cfg.variant} dot>
      {cfg.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Follow-up status badge
// ---------------------------------------------------------------------------
const followUpConfig: Record<
  FollowUpStatus,
  { label: string; variant: Parameters<typeof Badge>[0]['variant'] }
> = {
  none: { label: 'None', variant: 'neutral' },
  required: { label: 'Required', variant: 'warning' },
  contacted: { label: 'Contacted', variant: 'info' },
  resolved: { label: 'Resolved', variant: 'success' },
};

export function FollowUpBadge({ status }: { status: FollowUpStatus }) {
  const cfg = followUpConfig[status];
  return (
    <Badge variant={cfg.variant} dot>
      {cfg.label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Rating badge (coloured by severity)
// ---------------------------------------------------------------------------
export function RatingBadge({ rating }: { rating: number }) {
  const variant =
    rating >= 4 ? 'success' : rating === 3 ? 'warning' : 'danger';
  return (
    <Badge variant={variant}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)} {rating}/5
    </Badge>
  );
}
