import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  onRatingSelect: (rating: number) => void;
}

export const StarRating: React.FC<StarRatingProps> = ({ rating, onRatingSelect }) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="text-center space-y-3">
      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
        How was your experience today?
      </h2>
      <p className="text-xs sm:text-sm text-slate-500">
        Tap a star to rate your hospital visit (1 to 5)
      </p>

      {/* 1-5 Star Interactive Controls */}
      <div className="flex items-center justify-center gap-2 py-2">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = (hoverRating || rating) >= star;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onRatingSelect(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 rounded-xl transition-all transform hover:scale-110 focus:outline-none"
              aria-label={`Rate ${star} star`}
            >
              <Star
                className={`w-9 h-9 sm:w-11 sm:h-11 transition-colors ${
                  isFilled
                    ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                    : 'text-slate-200 fill-slate-100'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Rating Status Badge */}
      {rating > 0 && (
        <div className="animate-in fade-in duration-200">
          <span
            className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
              rating >= 4 ? 'bg-primary-100 text-primary-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {rating === 5 && '🌟 Excellent — Highly Satisfied'}
            {rating === 4 && '👍 Very Good — Satisfied'}
            {rating === 3 && '😐 Average — Neutral'}
            {rating === 2 && '👎 Fair — Issues Faced'}
            {rating === 1 && '⚠️ Poor — Highly Dissatisfied'}
          </span>
        </div>
      )}
    </div>
  );
};
