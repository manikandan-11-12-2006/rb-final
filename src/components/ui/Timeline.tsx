import React from 'react';
import { CheckCircle, Circle, Clock } from 'lucide-react';

export type TimelineStepStatus = 'completed' | 'current' | 'pending';

export interface TimelineStep {
  label: string;
  timestamp?: string;
  status: TimelineStepStatus;
  description?: string;
}

interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
}

export function Timeline({ steps, className = '' }: TimelineProps) {
  return (
    <ol className={`relative space-y-0 ${className}`} aria-label="Progress timeline">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical connector line */}
            {!isLast && (
              <div
                className={[
                  'absolute left-4 top-8 bottom-0 w-0.5',
                  step.status === 'completed'
                    ? 'bg-primary-300'
                    : 'bg-slate-200',
                ].join(' ')}
                aria-hidden
              />
            )}

            {/* Step icon */}
            <div className="relative z-10 shrink-0 mt-0.5">
              {step.status === 'completed' ? (
                <CheckCircle
                  className="h-8 w-8 text-primary-500"
                  aria-hidden
                />
              ) : step.status === 'current' ? (
                <Clock
                  className="h-8 w-8 text-blue-500"
                  aria-hidden
                />
              ) : (
                <Circle
                  className="h-8 w-8 text-slate-300"
                  aria-hidden
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
              <p
                className={[
                  'text-sm font-medium',
                  step.status === 'completed'
                    ? 'text-slate-900'
                    : step.status === 'current'
                    ? 'text-blue-700'
                    : 'text-slate-400',
                ].join(' ')}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
              )}
              {step.timestamp && (
                <p className="text-xs text-slate-400 mt-0.5">{step.timestamp}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
