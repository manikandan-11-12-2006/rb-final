import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-primary-50 text-primary-800 border border-primary-200',
  success: 'bg-primary-50 text-primary-800 border border-primary-200',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200',
  danger:  'bg-red-50 text-red-700 border border-red-200',
  info:    'bg-blue-50 text-blue-700 border border-blue-200',
  neutral: 'bg-surface-raised text-ink-muted border border-surface-border',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-primary-500',
  success: 'bg-primary-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  neutral: 'bg-ink-subtle',
};

export function Badge({
  variant = 'default',
  children,
  className = '',
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium',
        variantClasses[variant],
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
