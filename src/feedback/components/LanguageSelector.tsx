import React from 'react';
import { Globe } from 'lucide-react';

export const LANGUAGES = [
  { code: 'en-IN', label: 'English (Indian / International)' },
  { code: 'ta-IN', label: 'Tamil — தமிழ்' },
  { code: 'hi-IN', label: 'Hindi — हिंदी' },
  { code: 'te-IN', label: 'Telugu — తెలుగు' },
  { code: 'kn-IN', label: 'Kannada — ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'Malayalam — മലയാളം' },
  { code: 'mr-IN', label: 'Marathi — मराठी' },
  { code: 'bn-IN', label: 'Bengali — বাংলা' },
  { code: 'gu-IN', label: 'Gujarati — ગુજરાતી' },
  { code: 'pa-IN', label: 'Punjabi — ਪੰਜਾਬੀ' },
];

interface LanguageSelectorProps {
  selectedLang: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLang,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5 text-slate-500" />
        Spoken Language Context
      </label>
      <select
        value={selectedLang}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full text-xs font-medium bg-white rounded-xl border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
};
