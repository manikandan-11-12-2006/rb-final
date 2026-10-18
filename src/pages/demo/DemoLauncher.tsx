import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Mic,
  ArrowRight,
  LayoutDashboard,
  MessageSquare,
  Zap,
  CheckCircle,
  XCircle,
  Activity,
  LogIn,
} from 'lucide-react';

const clinicName = import.meta.env.VITE_CLINIC_NAME || 'ABC Healthcare';

interface FlowCardProps {
  label: string;
  description: string;
  steps: string[];
  icon: React.ReactNode;
  accentClass: string;
  borderClass: string;
  onClick: () => void;
}

function FlowCard({ label, description, steps, icon, accentClass, borderClass, onClick }: FlowCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border-2 ${borderClass} rounded-2xl p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 transition-all group`}
      aria-label={`Launch: ${label}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className={`p-2.5 rounded-xl ${accentClass} shrink-0`}>{icon}</span>
        <div>
          <p className="text-sm font-semibold text-slate-900 group-hover:text-green-700 transition-colors">{label}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-green-500 ml-auto transition-colors" aria-hidden />
      </div>
      <ol className="space-y-1 pl-1">
        {steps.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-slate-500">
            <span className="w-4 h-4 rounded-full bg-stone-100 flex items-center justify-center text-slate-400 font-medium shrink-0 text-[10px]">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </button>
  );
}

export default function DemoLauncher() {
  const navigate = useNavigate();

  const flows: FlowCardProps[] = [
    {
      label: 'Test 5-Star Journey',
      description: 'Full positive feedback → AI review → Google redirect',
      accentClass: 'bg-yellow-100 text-yellow-600',
      borderClass: 'border-yellow-200 hover:border-yellow-400',
      icon: <Star className="h-5 w-5" aria-hidden />,
      steps: [
        'Patient receives feedback request',
        'Selects 5 stars',
        'Types or speaks feedback',
        'AI prepares review',
        'Review copied, Google review opened',
        'Completion page shown',
      ],
      onClick: () => navigate('/patient/feedback?name=Priya&rating=5'),
    },
    {
      label: 'Test 4-Star Journey',
      description: 'Positive feedback — slightly different AI output',
      accentClass: 'bg-green-100 text-green-600',
      borderClass: 'border-green-200 hover:border-green-400',
      icon: <CheckCircle className="h-5 w-5" aria-hidden />,
      steps: [
        'Patient selects 4 stars',
        'Submits text feedback',
        'AI cleans review',
        'Redirected to Google Reviews',
      ],
      onClick: () => navigate('/patient/feedback?name=Arun&rating=4'),
    },
    {
      label: 'Test 3-Star Journey',
      description: 'Neutral — no Google review redirect',
      accentClass: 'bg-amber-100 text-amber-600',
      borderClass: 'border-amber-200 hover:border-amber-400',
      icon: <XCircle className="h-5 w-5" aria-hidden />,
      steps: [
        'Patient selects 3 stars',
        'Staff follow-up triggered internally',
        'No Google review shown to patient',
      ],
      onClick: () => navigate('/patient/feedback?name=Meena&rating=3'),
    },
    {
      label: 'Test Low Rating (1–2 Stars)',
      description: 'Internal escalation, no public review',
      accentClass: 'bg-orange-100 text-orange-600',
      borderClass: 'border-orange-200 hover:border-orange-400',
      icon: <XCircle className="h-5 w-5" aria-hidden />,
      steps: [
        'Patient selects 1 or 2 stars',
        'Thanked privately',
        'Staff alerted for follow-up',
        'No Google review redirect',
      ],
      onClick: () => navigate('/patient/feedback?name=Suresh&rating=2'),
    },
    {
      label: 'Test Voice Feedback',
      description: 'Voice note → transcription → AI review',
      accentClass: 'bg-green-100 text-green-700',
      borderClass: 'border-green-200 hover:border-green-400',
      icon: <Mic className="h-5 w-5" aria-hidden />,
      steps: [
        'Patient selects 5 stars',
        'Chooses "Voice note" option',
        'Recording simulated',
        'Transcription mocked via Sarvam',
        'Review prepared and shown',
      ],
      onClick: () => navigate('/patient/feedback?name=Divya&rating=5&voice=1'),
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col items-center py-12 px-4"
      style={{ background: 'linear-gradient(160deg, #f0fdf4 0%, #fefce8 60%, #fff7ed 100%)' }}
    >
      {/* Header */}
      <div className="text-center mb-10 max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md"
            style={{ background: 'linear-gradient(135deg, #16a34a, #ea580c)' }}
          >
            <Activity className="h-6 w-6 text-white" aria-hidden />
          </div>
          <span className="text-2xl font-bold text-slate-800">ReviewBridge</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Patient Feedback Automation Demo</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
          Test the complete patient feedback journey end-to-end.
          All data is mocked — no backend required.
        </p>
        <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full px-3 py-1.5 mt-3 border border-amber-200">
          <Zap className="h-3.5 w-3.5" aria-hidden />
          Demo mode — no real data is sent or stored
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-8">

        {/* Patient journeys */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 mb-3">
            Patient Journeys
          </p>
          <div className="space-y-3">
            {flows.map((flow) => (
              <FlowCard key={flow.label} {...flow} />
            ))}
          </div>
        </div>

        {/* Staff interface */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1 mb-3">
            Staff Interface
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/staff')}
              className="w-full text-left bg-white border-2 border-green-200 hover:border-green-400 rounded-2xl p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-green-100 text-green-700 shrink-0">
                  <LayoutDashboard className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-green-700 transition-colors">
                    Open Staff Dashboard
                  </p>
                  <p className="text-xs text-slate-500">View feedback, manage follow-ups, monitor campaigns</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-green-500 ml-auto" aria-hidden />
              </div>
            </button>

            <button
              onClick={() => navigate('/staff/feedback')}
              className="w-full text-left bg-white border-2 border-amber-200 hover:border-amber-400 rounded-2xl p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                  <MessageSquare className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">
                    View All Feedback
                  </p>
                  <p className="text-xs text-slate-500">Browse mock feedback records with filters and search</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-500 ml-auto" aria-hidden />
              </div>
            </button>

            <button
              onClick={() => navigate('/login')}
              className="w-full text-left bg-white border-2 border-orange-200 hover:border-orange-400 rounded-2xl p-5 shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-orange-100 text-orange-600 shrink-0">
                  <LogIn className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                    Back to Login
                  </p>
                  <p className="text-xs text-slate-500">View the login page</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-orange-400 ml-auto" aria-hidden />
              </div>
            </button>
          </div>
        </div>
      </div>

      <p className="mt-10 text-xs text-slate-400 text-center">
        {clinicName} · ReviewBridge Demo · Frontend prototype only
      </p>
    </div>
  );
}
