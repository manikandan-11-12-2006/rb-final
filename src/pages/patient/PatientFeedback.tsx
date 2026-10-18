import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mic, MicOff, Send, ChevronRight, Keyboard, StopCircle } from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import { StarRating } from '../../components/ui/StarRating';
import { useFeedback } from '../../hooks/useFeedback';

// ---------------------------------------------------------------------------
// Chat bubble components
// ---------------------------------------------------------------------------
function ClinicBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
        A
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm max-w-[85%]">
        {children}
      </div>
    </div>
  );
}

function PatientBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="bg-blue-700 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-sm max-w-[85%]">
        {children}
      </div>
    </div>
  );
}

function VoiceTimer({ seconds }: { seconds: number }) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return <span className="font-mono text-sm text-red-600 font-semibold">{mm}:{ss}</span>;
}

type Step =
  | 'greeting'
  | 'rating'
  | 'rated'
  | 'feedback_choice'
  | 'text_input'
  | 'voice_input'
  | 'submitting'
  | 'done_low'
  | 'done_high';

const clinicName = import.meta.env.VITE_CLINIC_NAME || 'ABC Healthcare';

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function PatientFeedback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientName = searchParams.get('name') || 'Priya';
  const presetRating = Number(searchParams.get('rating') || 0);

  const [step, setStep] = useState<Step>('greeting');
  const [rating, setRating] = useState(0);
  const [textFeedback, setTextFeedback] = useState('');
  const [textError, setTextError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const { state: submitState, response, submit } = useFeedback();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on step changes
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [step, submitState]);

  // Show greeting then advance to rating
  useEffect(() => {
    const t = setTimeout(() => setStep('rating'), 800);
    return () => clearTimeout(t);
  }, []);

  // Auto-select preset rating (demo mode)
  useEffect(() => {
    if (presetRating >= 1 && step === 'rating') {
      const t = setTimeout(() => handleRating(presetRating), 600);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // React to submission result
  useEffect(() => {
    if (submitState === 'success' && response) {
      setStep(response.reviewStatus === 'review_ready' ? 'done_high' : 'done_low');
    }
    if (submitState === 'error') {
      setStep(voiceTranscript ? 'voice_input' : textFeedback ? 'text_input' : 'feedback_choice');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitState, response]);

  const handleRating = (r: number) => {
    setRating(r);
    setStep('rated');
    setTimeout(() => setStep('feedback_choice'), 700);
  };

  const handleChooseText = () => {
    setStep('text_input');
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleChooseVoice = () => {
    setStep('voice_input');
    setIsRecording(true);
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => {
      setVoiceTranscript(
        'The doctor was very helpful and explained the treatment clearly. I felt well cared for throughout my visit.'
      );
    }, 1500);
  };

  const handleSubmit = async () => {
    if (step === 'text_input' && !textFeedback.trim()) {
      setTextError('Please type your feedback before submitting.');
      return;
    }
    setTextError('');
    const wasVoice = step === 'voice_input' || !!voiceTranscript;
    setStep('submitting');
    await submit({
      sessionId: `session-${Date.now()}`,
      rating,
      feedbackType: wasVoice ? 'voice' : 'text',
      originalFeedback: textFeedback || voiceTranscript || undefined,
    });
  };

  // Steps where the rating bubble is visible
  const ratingVisible: Step[] = ['rated', 'feedback_choice', 'text_input', 'voice_input', 'submitting', 'done_low', 'done_high'];
  // Steps where the "tell us more" prompt is visible
  const promptVisible: Step[] = ['feedback_choice', 'text_input', 'voice_input', 'submitting', 'done_low', 'done_high'];

  return (
    <div className="flex flex-col min-h-[80vh]">
      {/* Chat header */}
      <div className="bg-blue-700 text-white rounded-t-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
          A
        </div>
        <div>
          <p className="text-sm font-semibold">{clinicName}</p>
          <p className="text-xs text-blue-200">Official feedback channel</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 bg-slate-100 px-4 py-4 space-y-1 min-h-[50vh] overflow-y-auto">

        {/* Greeting */}
        <ClinicBubble>
          <p className="text-sm text-slate-800">
            Hello <strong>{patientName}</strong>! 👋 Thank you for visiting {clinicName}.
          </p>
          <p className="text-sm text-slate-800 mt-1">We'd love to hear about your experience.</p>
        </ClinicBubble>

        {/* Rating prompt */}
        {step !== 'greeting' && (
          <ClinicBubble>
            <p className="text-sm text-slate-800 mb-3">Please rate your visit:</p>
            {step === 'rating' ? (
              <StarRating value={rating} onChange={handleRating} size="xl" showLabel />
            ) : (
              <StarRating value={rating} readonly size="md" />
            )}
          </ClinicBubble>
        )}

        {/* Patient's rating reply */}
        {ratingVisible.includes(step) && (
          <PatientBubble>
            <p className="text-sm">{'⭐'.repeat(rating)} {rating}/5</p>
          </PatientBubble>
        )}

        {/* "Tell us more" prompt */}
        {promptVisible.includes(step) && (
          <ClinicBubble>
            <p className="text-sm text-slate-800">Would you like to tell us more? (optional)</p>
          </ClinicBubble>
        )}

        {/* Choice buttons */}
        {step === 'feedback_choice' && (
          <div className="flex gap-2 justify-center py-2">
            <button
              onClick={handleChooseText}
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-full px-4 py-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            >
              <Keyboard className="h-4 w-4" aria-hidden /> Type feedback
            </button>
            <button
              onClick={handleChooseVoice}
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-full px-4 py-2 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            >
              <Mic className="h-4 w-4" aria-hidden /> Voice note
            </button>
          </div>
        )}

        {/* Text input box */}
        {step === 'text_input' && (
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <textarea
              ref={textareaRef}
              rows={3}
              value={textFeedback}
              onChange={(e) => { setTextFeedback(e.target.value); setTextError(''); }}
              placeholder="Share your experience here…"
              className="w-full text-sm text-slate-800 resize-none focus:outline-none placeholder-slate-400"
              aria-label="Type your feedback"
            />
            {textError && <p className="text-xs text-red-500 mt-1" role="alert">{textError}</p>}
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSubmit}
                className="flex items-center gap-1.5 bg-blue-700 text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
              >
                <Send className="h-4 w-4" aria-hidden /> Submit Feedback
              </button>
            </div>
          </div>
        )}

        {/* Voice input box */}
        {step === 'voice_input' && (
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm">
            {!voiceTranscript ? (
              <div className="flex flex-col items-center gap-3">
                {isRecording ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center animate-pulse">
                      <Mic className="h-7 w-7 text-red-500" aria-hidden />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Listening…</span>
                      <VoiceTimer seconds={recordingSeconds} />
                    </div>
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-1.5 bg-red-600 text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 transition-colors"
                      aria-label="Stop recording"
                    >
                      <StopCircle className="h-4 w-4" aria-hidden /> Stop
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                      <MicOff className="h-7 w-7 text-slate-400" aria-hidden />
                    </div>
                    <div className="flex items-center gap-2">
                      <Spinner size="sm" />
                      <span className="text-sm text-slate-500">Processing voice feedback…</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Voice feedback received
                </p>
                <p className="text-sm text-slate-700 italic bg-slate-50 rounded-lg px-3 py-2">
                  "{voiceTranscript}"
                </p>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleSubmit}
                    className="flex items-center gap-1.5 bg-blue-700 text-white text-sm font-medium rounded-full px-4 py-2 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                  >
                    <Send className="h-4 w-4" aria-hidden /> Submit Feedback
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submitting */}
        {step === 'submitting' && (
          <ClinicBubble>
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <p className="text-sm text-slate-600">Submitting your feedback…</p>
            </div>
          </ClinicBubble>
        )}

        {/* Low rating — no Google review */}
        {step === 'done_low' && (
          <ClinicBubble>
            <p className="text-sm text-slate-800 font-bold">Thank You for Sharing Your Feedback</p>
            <p className="text-sm text-slate-600 mt-1">
              We truly appreciate you taking the time to share your experience. Your feedback has been received and will be reviewed by our Medical Director and patient relations team.
            </p>
          </ClinicBubble>
        )}

        {/* High rating — proceed to review */}
        {step === 'done_high' && (
          <>
            <ClinicBubble>
              <p className="text-sm text-slate-800 font-medium">Thank you! 🎉</p>
              <p className="text-sm text-slate-600 mt-1">
                We've prepared your feedback for a quick review.
              </p>
            </ClinicBubble>
            <div className="flex justify-center py-2">
              <button
                onClick={() => navigate(`/patient/review/${response?.feedbackId ?? 'demo'}`)}
                className="flex items-center gap-2 bg-blue-700 text-white text-sm font-semibold rounded-full px-6 py-3 hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors shadow-md"
                aria-label="Continue to review page"
              >
                Continue <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Privacy bar */}
      <div className="bg-white border-t border-slate-200 rounded-b-2xl px-4 py-2 text-center">
        <p className="text-xs text-slate-400">
          Your feedback is private and securely handled by {clinicName}.
        </p>
      </div>
    </div>
  );
}
