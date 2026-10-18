import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-10 w-10',
};

const labels: Record<number, string> = {
  1: 'Very poor',
  2: 'Poor',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

export function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
  showLabel = false,
  className = '',
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0);
  const effective = hovered || value;

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <div
        role={readonly ? 'img' : 'radiogroup'}
        aria-label={readonly ? `Rating: ${value} out of 5` : 'Select a rating'}
        className="flex gap-1"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role={readonly ? undefined : 'radio'}
            aria-checked={readonly ? undefined : value === star}
            aria-label={readonly ? undefined : `${star} star${star > 1 ? 's' : ''} – ${labels[star]}`}
            disabled={readonly}
            onClick={() => !readonly && onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={[
              'transition-transform duration-100',
              !readonly ? 'cursor-pointer hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 rounded' : 'cursor-default',
              'disabled:cursor-default',
            ].join(' ')}
          >
            <Star
              className={[
                sizeMap[size],
                effective >= star
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-slate-300',
                'transition-colors duration-100',
              ].join(' ')}
              aria-hidden
            />
          </button>
        ))}
      </div>
      {showLabel && effective > 0 && (
        <span className="text-sm font-medium text-slate-600">
          {labels[effective]}
        </span>
      )}
    </div>
  );
}
