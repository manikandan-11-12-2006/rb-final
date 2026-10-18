import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function Spinner({ size = 'md', label = 'Loading…', className = '' }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={`inline-flex ${className}`}>
      <Loader2
        className={`${sizeClasses[size]} text-blue-600 animate-spin`}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

interface PageSpinnerProps {
  message?: string;
}

export function PageSpinner({ message = 'Loading…' }: PageSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
      <Spinner size="lg" label={message} />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
