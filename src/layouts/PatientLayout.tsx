import React from 'react';
import { Outlet } from 'react-router-dom';
import { Brain } from 'lucide-react';

const clinicName = import.meta.env.VITE_CLINIC_NAME || 'ABC Healthcare';

export function PatientLayout() {
  return (
    <div className="min-h-screen bg-surface-subtle flex flex-col items-center justify-start py-8 px-4">
      {/* Minimal clinic strip */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-7 h-7 rounded-lg bg-ink-DEFAULT flex items-center justify-center shrink-0">
          <Brain className="h-3.5 w-3.5 text-white" aria-hidden />
        </div>
        <span className="text-sm font-bold text-ink-DEFAULT">{clinicName}</span>
      </div>

      <div className="w-full max-w-sm">
        <Outlet />
      </div>

      <p className="mt-8 text-xs text-ink-subtle text-center">
        Your feedback is private and handled securely.
      </p>
    </div>
  );
}
