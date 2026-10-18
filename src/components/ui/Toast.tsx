import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { Toast as ToastItem, ToastType } from '../../hooks/useToast';

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-primary-500 shrink-0" aria-hidden />,
  error: <XCircle className="h-5 w-5 text-red-500 shrink-0" aria-hidden />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" aria-hidden />,
  info: <Info className="h-5 w-5 text-blue-500 shrink-0" aria-hidden />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-l-primary-500',
  error: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-blue-500',
};

interface ToastItemProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        'flex items-start gap-3 bg-white rounded-xl shadow-lg border border-slate-200 border-l-4 px-4 py-3',
        'animate-[slideIn_0.2s_ease-out]',
        borderColors[toast.type],
      ].join(' ')}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm text-slate-700">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded shrink-0"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
