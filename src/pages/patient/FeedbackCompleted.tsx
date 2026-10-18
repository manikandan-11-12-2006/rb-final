import React from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { toFeedbackRef } from '../../utils/formatters';

const clinicName = import.meta.env.VITE_CLINIC_NAME || 'ABC Healthcare';

export default function FeedbackCompleted() {
  const { id } = useParams<{ id: string }>();
  const ref = id ? toFeedbackRef(id) : 'FB-00000';

  return (
    <div className="flex flex-col items-center text-center py-10 space-y-5">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center shadow-sm">
        <CheckCircle className="h-10 w-10 text-primary-500" aria-hidden />
      </div>

      {/* Heading */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Thank you!</h1>
        <p className="text-base text-slate-600 mt-1">Your feedback has been recorded.</p>
      </div>

      {/* Message */}
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 shadow-sm max-w-xs w-full">
        <p className="text-sm text-slate-600 leading-relaxed">
          Thank you for taking a moment to share your experience with{' '}
          <strong>{clinicName}</strong>. Your feedback helps us improve care for every patient.
        </p>
      </div>

      {/* Reference */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3">
        <p className="text-xs text-slate-500 mb-1">Feedback Reference</p>
        <p className="text-sm font-mono font-semibold text-slate-800 tracking-wide">{ref}</p>
      </div>

      <p className="text-xs text-slate-400">You can now close this page.</p>
    </div>
  );
}
