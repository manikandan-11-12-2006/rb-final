import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Star,
  Building2,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Send,
  HeartHandshake,
  Mic,
  StopCircle,
  Loader2,
  Wand2,
  ChevronDown,
  Copy,
  ClipboardCheck,
} from 'lucide-react';
import { db } from '../../services/db';
import {
  startSpeechRecognition,
  cleanWithGemini,
  isSpeechRecognitionSupported,
} from '../../services/voiceTranscriptionService';
import { Visit } from '../../types/database';
import { analyzeSentimentLocally } from '../../services/sentimentAnalysisService';

// ─── Languages ────────────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'ta-IN', label: 'Tamil — தமிழ்' },
  { code: 'hi-IN', label: 'Hindi — हिंदी' },
  { code: 'te-IN', label: 'Telugu — తెలుగు' },
  { code: 'kn-IN', label: 'Kannada — ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'Malayalam — മലയാളം' },
  { code: 'mr-IN', label: 'Marathi — मराठी' },
  { code: 'bn-IN', label: 'Bengali — বাংলা' },
  { code: 'gu-IN', label: 'Gujarati — ગુજરાતી' },
  { code: 'pa-IN', label: 'Punjabi — ਪੰਜਾਬੀ' },
  { code: 'en-IN', label: 'English' },
];

// ─── Pipeline Step ─────────────────────────────────────────────────────────────
function PipelineStep({ icon, label, status }: {
  icon: React.ReactNode;
  label: string;
  status: 'waiting' | 'active' | 'done';
}) {
  const colors = {
    waiting: 'bg-slate-100 text-slate-400 border-slate-200',
    active:  'bg-blue-50 text-blue-600 border-blue-300',
    done:    'bg-primary-50 text-primary-700 border-primary-300',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${colors[status]}`}>
      {status === 'active'
        ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        : status === 'done'
        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-primary-600" />
        : <span className="w-3.5 h-3.5 shrink-0 opacity-40">{icon}</span>}
      {label}
    </div>
  );
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function VoiceTimer({ seconds }: { seconds: number }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return <span className="font-mono text-sm font-bold text-red-600">{mm}:{ss}</span>;
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
        copied
          ? 'bg-primary-100 text-primary-700 border border-primary-300'
          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
      }`}
    >
      {copied
        ? <><ClipboardCheck className="w-3.5 h-3.5" /> Copied!</>
        : <><Copy className="w-3.5 h-3.5" /> Copy Text</>}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PublicReviewPage() {
  const [searchParams] = useSearchParams();
  const token =
    searchParams.get('token') ||
    searchParams.get('visit_id') ||
    'token-citycare-kavitha-001';

  const [visit, setVisit]             = useState<Visit | null>(null);
  const [loading, setLoading]         = useState(true);
  const [rating, setRating]           = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting]   = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [finalReviewText, setFinalReviewText] = useState(''); // Text to paste on Google
  const [clipboardCopied, setClipboardCopied] = useState(false);

  // Feedback mode
  const [feedbackMode, setFeedbackMode] = useState<'voice' | 'text' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  // Voice phases
  type VoicePhase = 'idle' | 'recording' | 'transcript_ready' | 'cleaning' | 'done' | 'error';
  const [voicePhase, setVoicePhase]         = useState<VoicePhase>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveText, setLiveText]             = useState('');
  const [rawTranscript, setRawTranscript]   = useState('');
  const [cleanedText, setCleanedText]       = useState('');
  const [selectedLang, setSelectedLang]     = useState('ta-IN');
  const [voiceError, setVoiceError]         = useState('');

  const stopFnRef = useRef<(() => void) | null>(null);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = isSpeechRecognitionSupported();

  // ── Load visit ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const found = await db.getVisitByToken(token);
        if (found) setVisit(found);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  // ── Star click ─────────────────────────────────────────────────────────────
  const handleStarClick = (star: number) => {
    setRating(star);
    setFeedbackMode(null);
    setVoicePhase('idle');
    setRawTranscript('');
    setCleanedText('');
    setLiveText('');
    setVoiceError('');
    setFeedbackText('');
  };

  // ── Auto-copy to clipboard ─────────────────────────────────────────────────
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setClipboardCopied(true);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setClipboardCopied(true);
    }
  };

  // ── Submit voice ───────────────────────────────────────────────────────────
  const handleVoiceSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await db.submitReview({
        tokenOrId: token,
        rating,
        feedbackType: 'voice',
        voiceTranscript: rawTranscript,
        cleanedReview: cleanedText,
        detectedLanguage: selectedLang,
      });
      setFinalReviewText(cleanedText);
      // Auto-copy cleaned text to clipboard for Google Reviews paste
      if (rating >= 4 && cleanedText) {
        await copyToClipboard(cleanedText);
      }
      setSubmitted(true);
      if (result.redirectUrl) {
        setRedirectUrl(result.redirectUrl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit text ────────────────────────────────────────────────────────────
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await db.submitReview({
        tokenOrId: token,
        rating,
        feedbackText,
        feedbackType: 'text',
      });
      setFinalReviewText(feedbackText);
      if (rating >= 4 && feedbackText) {
        await copyToClipboard(feedbackText);
      }
      setSubmitted(true);
      if (result.redirectUrl) setRedirectUrl(result.redirectUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = () => {
    setVoiceError('');
    setLiveText('');
    setRawTranscript('');
    setCleanedText('');
    setRecordingSeconds(0);

    const { stop, promise } = startSpeechRecognition({
      lang: selectedLang,
      maxSeconds: 60,
      onInterim: (text) => setLiveText(text),
    });
    stopFnRef.current = stop;
    setVoicePhase('recording');
    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);

    promise
      .then(({ transcript, success }) => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (!success || !transcript.trim()) {
          setVoiceError('No speech detected. Please speak clearly and try again.');
          setVoicePhase('error');
          return;
        }
        setRawTranscript(transcript);
        setLiveText('');
        setVoicePhase('transcript_ready');
      })
      .catch((err) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const msg = (err?.message || '').toLowerCase();
        setVoiceError(
          msg.includes('not-allowed') || msg.includes('permission')
            ? 'Microphone permission denied. Please allow mic access in your browser.'
            : 'Could not recognise speech. Please try again or type your feedback.'
        );
        setVoicePhase('error');
      });
  };

  const stopRecording = () => {
    stopFnRef.current?.();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleCleanWithGroq = async () => {
    setVoicePhase('cleaning');
    const { cleanedText: cleaned, success } = await cleanWithGemini(rawTranscript, selectedLang);
    setCleanedText(success ? cleaned : rawTranscript);
    setVoicePhase('done');
  };

  const resetVoice = () => {
    setVoicePhase('idle');
    setRawTranscript('');
    setCleanedText('');
    setLiveText('');
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading your review session...</p>
        </div>
      </div>
    );
  }

  const hospitalName = visit?.hospital?.name || 'Hospital Care Partner';
  const hospitalLogo = visit?.hospital?.logo;
  const patientName  = visit?.patient?.name  || 'Valued Patient';
  const doctorName   = visit?.doctor         || 'your consulting physician';
  const department   = visit?.department     || 'Outpatient Services';

  const starLabels: Record<number, string> = {
    1: 'Poor Experience',
    2: 'Needs Improvement',
    3: 'Average / Fair',
    4: 'Very Good Experience',
    5: 'Excellent 5-Star Care!',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50/50 via-white to-slate-50 py-10 px-4 sm:px-6">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          {hospitalLogo ? (
            <img src={hospitalLogo} alt={hospitalName}
              className="w-16 h-16 rounded-2xl mx-auto mb-3 object-cover shadow-sm border border-slate-200" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-primary-700 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
              <Building2 className="w-8 h-8" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">{hospitalName}</h1>
          <div className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full border border-primary-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Patient Review
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6">

          {/* Visit summary */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Consultation</p>
            <p className="text-base font-bold text-slate-800 mt-1">Hello, {patientName} 👋</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Thank you for visiting <span className="font-semibold text-slate-800">{hospitalName}</span>!{' '}
              Consulted with <span className="font-medium">{doctorName}</span> ({department})
            </p>
          </div>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/*  BEFORE SUBMIT                                                  */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {!submitted ? (
            <>
              {/* ── STAR RATING ─────────────────────────────────────────── */}
              <div className="text-center">
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  How would you rate your visit?
                </h2>
                <p className="text-xs text-slate-500 mb-4">Tap a star to begin</p>

                <div className="flex justify-center items-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (hoverRating || rating) >= star;
                    return (
                      <button key={star} type="button"
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => handleStarClick(star)}
                        className="p-1 sm:p-2 transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                      >
                        <Star className={`w-11 h-11 transition-colors ${
                          active ? 'text-amber-400 fill-amber-400 drop-shadow-sm' : 'text-slate-300'
                        }`} />
                      </button>
                    );
                  })}
                </div>

                <div className="h-5 text-center">
                  {(hoverRating || rating) > 0
                    ? <span className="text-sm font-semibold text-slate-800">{starLabels[hoverRating || rating]}</span>
                    : <span className="text-xs text-slate-400">Tap a star to rate</span>}
                </div>
              </div>

              {/* ── FEEDBACK (all ratings 1–5) ───────────────────────────── */}
              {rating > 0 && (
                <div className="space-y-4 pt-2 border-t border-slate-100">

                  {rating <= 3 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-900 leading-relaxed">
                        We're sorry your visit didn't meet expectations. Your feedback goes
                        <strong> privately</strong> to our management — it will not appear on Google.
                      </p>
                    </div>
                  )}

                  {rating >= 4 && (
                    <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-primary-900 leading-relaxed">
                        We'd love if you share your experience on Google Reviews!
                        Your review text will be <strong>auto-copied</strong> — just paste it on Google. 📋
                      </p>
                    </div>
                  )}

                  <p className="text-xs font-semibold text-slate-600 text-center">
                    Share your experience:
                  </p>

                  {/* Mode picker */}
                  {feedbackMode === null && (
                    <div className="grid grid-cols-2 gap-3">
                      {supported ? (
                        <button onClick={() => { setFeedbackMode('voice'); setVoicePhase('idle'); }}
                          className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-primary-200 bg-primary-50 hover:border-primary-400 hover:bg-primary-100 transition-all"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center">
                            <Mic className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-primary-800">Voice Message</span>
                          <span className="text-[10px] text-primary-700 text-center leading-tight">
                            Speak in your regional language
                          </span>
                          <span className="text-[9px] bg-primary-200 text-primary-800 px-2 py-0.5 rounded-full font-bold">FREE</span>
                        </button>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed">
                          <div className="w-10 h-10 rounded-full bg-slate-400 text-white flex items-center justify-center">
                            <Mic className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-bold text-slate-400">Voice Message</span>
                          <span className="text-[10px] text-slate-400 text-center">Chrome/Edge only</span>
                        </div>
                      )}

                      <button onClick={() => setFeedbackMode('text')}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-all"
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-700 text-white flex items-center justify-center">
                          <Send className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-800">Type Feedback</span>
                        <span className="text-[10px] text-slate-500 text-center leading-tight">Write in any language</span>
                      </button>
                    </div>
                  )}

                  {/* ─── VOICE FLOW ─────────────────────────────────────── */}
                  {feedbackMode === 'voice' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-600">🎤 Voice Feedback</p>
                        <button onClick={() => { setFeedbackMode(null); setVoicePhase('idle'); setVoiceError(''); setLiveText(''); }}
                          className="text-[11px] text-slate-400 hover:text-slate-600 underline">← Back</button>
                      </div>

                      {/* IDLE */}
                      {voicePhase === 'idle' && (
                        <div className="flex flex-col items-center gap-4 py-4">
                          <p className="text-xs text-slate-500 text-center">
                            Tap the mic and speak in <span className="font-semibold text-slate-700">your language</span>.<br />
                            You'll choose the language after recording.
                          </p>
                          <button onClick={startRecording}
                            className="w-24 h-24 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center shadow-xl transition-all active:scale-95"
                          >
                            <Mic className="w-10 h-10" />
                          </button>
                          <p className="text-[11px] text-slate-400">Tap to start recording</p>
                        </div>
                      )}

                      {/* RECORDING */}
                      {voicePhase === 'recording' && (
                        <div className="flex flex-col items-center gap-4 py-4">
                          <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center">
                              <Mic className="w-10 h-10 text-red-600" />
                            </div>
                            <span className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-25" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-sm text-slate-600 font-medium">Listening…</span>
                            <VoiceTimer seconds={recordingSeconds} />
                          </div>
                          {liveText && (
                            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Live preview</p>
                              <p className="text-xs text-slate-700 italic">"{liveText}"</p>
                            </div>
                          )}
                          <button onClick={stopRecording}
                            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-2xl transition-all shadow-md"
                          >
                            <StopCircle className="w-5 h-5" />
                            Stop Recording
                          </button>
                        </div>
                      )}

                      {/* TRANSCRIPT READY → pick language → clean */}
                      {voicePhase === 'transcript_ready' && (
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Your recorded speech</p>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-3">
                              <p className="text-sm text-slate-700 italic">"{rawTranscript}"</p>
                            </div>
                          </div>

                          {/* Language picker AFTER transcript */}
                          <div>
                            <p className="text-xs font-semibold text-slate-700 mb-2">
                              What language did you speak?
                              <span className="text-slate-400 font-normal"> (helps Groq translate correctly)</span>
                            </p>
                            <div className="relative">
                              <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}
                                className="w-full appearance-none text-sm font-medium text-slate-800 bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-primary-500 cursor-pointer"
                              >
                                {LANGUAGES.map((l) => (
                                  <option key={l.code} value={l.code}>{l.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button onClick={resetVoice}
                              className="flex-1 py-2.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all"
                            >Re-record</button>
                            <button onClick={handleCleanWithGroq}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-all shadow-sm"
                            >
                              <Wand2 className="w-4 h-4" />
                              Clean with Groq
                            </button>
                          </div>
                        </div>
                      )}

                      {/* CLEANING */}
                      {voicePhase === 'cleaning' && (
                        <div className="space-y-3 py-2">
                          <p className="text-xs font-semibold text-slate-600 text-center">Processing your feedback…</p>
                          <div className="flex flex-col gap-2">
                            <PipelineStep icon={<Mic className="w-3.5 h-3.5" />} label="Voice captured successfully" status="done" />
                            <PipelineStep icon={<Wand2 className="w-3.5 h-3.5" />} label="Cleaning & translating with Groq AI" status="active" />
                          </div>
                        </div>
                      )}

                      {/* DONE */}
                      {voicePhase === 'done' && (
                        <div className="space-y-3">
                          {rawTranscript !== cleanedText && (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Original transcript</p>
                              <p className="text-xs text-slate-500 italic bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">"{rawTranscript}"</p>
                            </div>
                          )}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Groq Cleaned</p>
                                <span className="text-[9px] bg-primary-50 text-primary-700 border border-primary-200 px-1.5 py-0.5 rounded font-bold">✓ AI Cleaned</span>
                              </div>
                              <CopyButton text={cleanedText} />
                            </div>
                            <textarea rows={3} value={cleanedText} onChange={(e) => setCleanedText(e.target.value)}
                              className="w-full text-sm rounded-xl border border-primary-300 bg-primary-50/30 p-3 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">You can edit before submitting.</p>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={resetVoice}
                              className="flex-1 py-2.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all"
                            >Re-record</button>
                            <button onClick={handleVoiceSubmit} disabled={submitting || !cleanedText.trim()}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl transition-all shadow-sm"
                            >
                              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Send Feedback
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ERROR */}
                      {voicePhase === 'error' && (
                        <div className="space-y-3">
                          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">{voiceError}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setVoicePhase('idle')}
                              className="flex-1 py-2.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-all"
                            >Try Again</button>
                            <button onClick={() => { setFeedbackMode('text'); setVoicePhase('idle'); }}
                              className="flex-1 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-xl hover:bg-slate-200 transition-all"
                            >Type Instead</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── TEXT FLOW ───────────────────────────────────────── */}
                  {feedbackMode === 'text' && (
                    <form onSubmit={handleTextSubmit} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">Share your experience</label>
                        {supported && (
                          <button type="button" onClick={() => { setFeedbackMode('voice'); setVoicePhase('idle'); }}
                            className="text-[11px] text-primary-600 hover:text-primary-700 underline"
                          >Use voice instead</button>
                        )}
                      </div>
                      <textarea rows={4} required value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Tell us about your experience — waiting time, doctor, nursing, billing, cleanliness…"
                        className="w-full text-sm rounded-xl border border-slate-300 p-3 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                      />
                      <button type="submit" disabled={submitting || !feedbackText.trim()}
                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        {submitting
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                          : <><Send className="w-4 h-4" /> Send Feedback</>}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          ) : (
            /* ═══════════════════════════════════════════════════════════════ */
            /*  AFTER SUBMIT                                                   */
            /* ═══════════════════════════════════════════════════════════════ */
            <div className="text-center space-y-4">
              {(() => {
                const sentimentResult = analyzeSentimentLocally(finalReviewText, rating);
                const isGoogleEligible = rating >= 4 && sentimentResult.sentiment === 'positive';
                return isGoogleEligible ? (
                /* HIGH RATING & POSITIVE SENTIMENT — Google Reviews flow */
                <>
                  <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Thank you for the {rating}★ rating!</h2>
                    <p className="text-sm text-slate-600 mt-1">
                      Please share your experience on Google Reviews — it helps other patients find great care.
                    </p>
                  </div>

                  {/* Cleaned text to paste */}
                  {finalReviewText && (
                    <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-primary-800 flex items-center gap-1.5">
                          {clipboardCopied
                            ? <><ClipboardCheck className="w-3.5 h-3.5" /> Copied to clipboard!</>
                            : <><Copy className="w-3.5 h-3.5" /> Your review text</>}
                        </p>
                        <CopyButton text={finalReviewText} />
                      </div>
                      <p className="text-sm text-slate-700 italic leading-relaxed">
                        "{finalReviewText}"
                      </p>
                      {clipboardCopied && (
                        <div className="flex items-center gap-2 bg-primary-100 rounded-xl px-3 py-2">
                          <ClipboardCheck className="w-4 h-4 text-primary-700 shrink-0" />
                          <p className="text-xs text-primary-800 font-semibold">
                            ✅ Text auto-copied! Just paste it (Ctrl+V on desktop / long-press on mobile) when you open Google Reviews.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step guide */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2">
                    <p className="text-xs font-bold text-slate-700 mb-2">How to post on Google Reviews:</p>
                    {[
                      '1️⃣  Tap "Open Google Reviews" below',
                      '2️⃣  Click "Write a review" on Google',
                      '3️⃣  Select your star rating',
                      '4️⃣  Paste your review text (Ctrl+V / long-press → Paste)',
                      '5️⃣  Click Submit ✅',
                    ].map((step) => (
                      <p key={step} className="text-xs text-slate-600">{step}</p>
                    ))}
                  </div>

                  {redirectUrl && (
                    <a href={redirectUrl} target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-4 px-6 rounded-2xl text-sm shadow-md hover:shadow-lg transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Google Reviews
                    </a>
                  )}
                </>
              ) : (
                /* LOW RATING — Private feedback */
                <>
                  <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
                    <HeartHandshake className="w-9 h-9" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Thank You for Sharing Your Feedback</h2>
                  <p className="text-sm text-slate-600">
                    We truly appreciate you taking the time to share your experience. Your feedback has been received and will be reviewed by our Medical Director and patient relations team.
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                    Confidential Report ID:{' '}
                    <span className="font-mono font-bold">
                      {visit?.sheet_row_id || visit?.id?.slice(0, 8) || 'anonymous'}
                    </span>
                  </div>
                </>
              );
            })()}
            </div>
          )}
        </div>

        <p className="text-center text-xs font-semibold text-slate-500 tracking-wide mt-6">
          Powered by Nayaruvi
        </p>
      </div>
    </div>
  );
}
