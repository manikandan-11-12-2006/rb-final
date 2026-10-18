import React, { useRef, useState } from 'react';
import { Mic, StopCircle, Loader2, Sparkles, AlertTriangle, CheckCircle2, Copy, ClipboardCheck } from 'lucide-react';
import { LanguageSelector } from './LanguageSelector';
import {
  startSpeechRecognition,
  cleanWithGroq,
  isSpeechRecognitionSupported,
} from '../services/voiceTranscription';

interface VoiceRecorderProps {
  selectedLang: string;
  onLanguageChange: (lang: string) => void;
  rawTranscript: string;
  setRawTranscript: (text: string) => void;
  cleanedText: string;
  setCleanedText: (text: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  selectedLang,
  onLanguageChange,
  rawTranscript,
  setRawTranscript,
  cleanedText,
  setCleanedText,
  onSubmit,
  submitting,
}) => {
  type VoicePhase = 'idle' | 'recording' | 'transcript_ready' | 'cleaning' | 'done' | 'error';
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveText, setLiveText] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [copied, setCopied] = useState(false);

  const stopFnRef = useRef<(() => Promise<void> | void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supported = isSpeechRecognitionSupported();

  const handleStartRecording = async () => {
    setVoicePhase('recording');
    setLiveText('');
    setRawTranscript('');
    setCleanedText('');
    setVoiceError('');
    setRecordingSeconds(0);

    timerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);

    const stop = await startSpeechRecognition(
      selectedLang,
      (partial) => {
        setLiveText(partial);
        setRawTranscript(partial);
      },
      (finalText) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const resolvedText = (finalText || liveText || rawTranscript).trim();
        setRawTranscript(resolvedText);
        setLiveText('');
        setVoicePhase('transcript_ready');
        handleCleanWithGroq(resolvedText);
      },
      (errorMsg) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setVoiceError(errorMsg);
        setVoicePhase('error');
      }
    );
    stopFnRef.current = stop;
  };

  const handleStopRecording = async () => {
    if (stopFnRef.current) {
      const fn = stopFnRef.current;
      stopFnRef.current = null;
      await fn();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const handleCleanWithGroq = async (textToClean?: string) => {
    const text = textToClean ?? rawTranscript;
    if (!text.trim()) return;

    setVoicePhase('cleaning');
    setVoiceError('');
    try {
      const cleaned = await cleanWithGroq(text, selectedLang);
      setCleanedText(cleaned);
      setVoicePhase('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Groq AI cleaning failed';
      setVoiceError(msg);
      setVoicePhase('transcript_ready');
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
    }
  };

  if (!supported) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
        Voice recording is not supported on this browser. Please use Google Chrome or Microsoft Edge.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Language dropdown */}
      <LanguageSelector
        selectedLang={selectedLang}
        onChange={onLanguageChange}
        disabled={voicePhase === 'recording'}
      />

      {/* Recording Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-4">
        {voicePhase === 'idle' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleStartRecording}
              className="w-16 h-16 rounded-full bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center mx-auto shadow-lg shadow-primary-600/30 transition-transform active:scale-95"
              title="Start voice recording"
            >
              <Mic className="w-7 h-7" />
            </button>
            <p className="text-xs text-slate-600 font-medium">
              Click mic button to start recording your voice
            </p>
          </div>
        )}

        {voicePhase === 'recording' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="font-mono text-sm font-bold text-rose-600">
                {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                {String(recordingSeconds % 60).padStart(2, '0')}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-mono italic min-h-[20px]">
              {liveText || 'Listening... Speak clearly'}
            </p>
            <button
              type="button"
              onClick={handleStopRecording}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all"
            >
              <StopCircle className="w-4 h-4" />
              <span>Stop & Transcribe</span>
            </button>
          </div>
        )}

        {voicePhase === 'cleaning' && (
          <div className="py-4 space-y-2">
            <Loader2 className="w-7 h-7 animate-spin text-primary-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">
              Groq AI is polishing grammar (preserving your exact content)...
            </p>
          </div>
        )}
      </div>

      {voiceError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{voiceError}</span>
        </div>
      )}

      {/* Real-time Voice Audio Transcription (Visible live as you speak each word) */}
      {(voicePhase === 'recording' || rawTranscript) && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              {voicePhase === 'recording' && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
              {voicePhase === 'recording' ? 'Live Audio Transcription' : 'Raw Audio Transcription'}
            </span>
            {voicePhase === 'recording' && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Transcribing
              </span>
            )}
          </div>
          <p className="text-xs text-slate-800 leading-relaxed font-mono min-h-[32px] break-words bg-white p-3 rounded-xl border border-slate-200">
            "{liveText || rawTranscript || 'Listening... Speak a word to see it here live'}"
          </p>
        </div>
      )}

      {/* Groq Cleaned Output (Only Grammar Changes, No Content Changes) */}
      {cleanedText && (
        <div className="bg-primary-50/70 border border-primary-200/80 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-600" />
              Groq Cleaned Feedback (Grammar Corrected)
            </span>
            <button
              type="button"
              onClick={() => copyText(cleanedText)}
              className="flex items-center gap-1 text-xs font-bold text-primary-700 hover:underline cursor-pointer"
            >
              {copied ? <ClipboardCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            value={cleanedText}
            onChange={(e) => setCleanedText(e.target.value)}
            className="w-full text-xs text-slate-800 bg-white p-3 rounded-xl border border-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 leading-relaxed font-sans"
            rows={3}
          />
          <p className="text-[10px] text-slate-500 italic">
            ✓ Content & meaning strictly preserved · Only grammar, punctuation, and capitalization corrected
          </p>
        </div>
      )}

      {/* Submit Button */}
      {(cleanedText || rawTranscript) && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-primary-600/20 transition-all text-xs sm:text-sm"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Submit Voice Feedback</span>
              <CheckCircle2 className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
};
