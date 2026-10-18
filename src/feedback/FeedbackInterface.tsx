/**
 * src/feedback/FeedbackInterface.tsx
 *
 * Modern Light-Themed 3D Card Patient Feedback Interface.
 * Features:
 *  - Light, clean white background and luminous 3D cards
 *  - 3-Second welcoming animation in light theme with medical center logo & name
 *  - Welcoming message:
 *    "We’d love to hear about your experience with us.
 *     Your feedback means a lot to us and helps us serve you better."
 *  - Patient Name input card (pre-filled or user editable)
 *  - Interactive 3D Star Rating (1 to 5 stars) on the same page
 *  - Voice Record (regional languages) & Type Feedback modes
 *  - Real-time submission directly to Firebase Realtime Database & Database storage
 *  - Post-review screen with recommended medical director review message
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Building2 as HospitalIcon,
  Loader2,
  Mic,
  MessageSquare,
  Send,
  User,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HeartHandshake,
  ExternalLink,
  ClipboardCheck,
  Star,
} from 'lucide-react';
import { db } from '../services/db';
import { Visit } from '../types/database';

import { StarRating } from './components/StarRating';
import { VoiceRecorder } from './components/VoiceRecorder';
import { cleanWithGroq } from './services/voiceTranscription';
import { analyzeSentimentLocally } from '../services/sentimentAnalysisService';

const TAMBARAM_GOOGLE_REVIEW_URL =
  (import.meta as any).env?.VITE_GOOGLE_REVIEW_URL ||
  'https://www.google.com/search?q=Tambaram%20Medical%20Center%20Google%20reviews#sv=CAESzQEKuQEStgEKd0FKaVQ0dExfWHgwY3JMVU1XbVVJcmsxMjdKS2tVRFBEZGxnQ0lqdkxVMlZ2YkpudkNtd2tIcUZJLWZ4ZFNPWTdySEpHQXN2QTBxUEZvZjYzOW9mdllpT1lxdWIyYmdKaUlDeTBBZmcwNklzQTJ4LWtiR2xmdktJEhczWXZBYXJMTEg1dU5zZU1Qb3BiYWlRVRoiQURzcjlmUzRSNzhzZzNpMzJNWGRDUy00SGoxSlZ3bUFBQRIEODA1MRoBMyoAMAA4AUAAGAAg8NSOHEoCEAE';

export default function FeedbackInterface() {
  const [searchParams] = useSearchParams();
  const params = useParams();

  const token =
    params.token ||
    searchParams.get('token') ||
    searchParams.get('visit_id') ||
    'token-citycare-kavitha-001';

  const queryName = searchParams.get('name') || searchParams.get('patient') || '';
  const queryPhone = searchParams.get('phone') || searchParams.get('phone_number') || searchParams.get('mobile') || '';
  const queryHospital = searchParams.get('hospital') || searchParams.get('hospitalName') || '';

  const [visit, setVisit]                         = useState<Visit | null>(null);
  const [loading, setLoading]                     = useState(true);
  const [patientName, setPatientName]             = useState(queryName);
  const [rating, setRating]                       = useState(0);
  const [submitting, setSubmitting]               = useState(false);
  const [submitted, setSubmitted]                 = useState(false);
  const [redirectUrl, setRedirectUrl]             = useState<string | null>(null);
  const [finalReviewText, setFinalReviewText]     = useState('');
  const [clipboardCopied, setClipboardCopied]     = useState(false);

  // 3-second Welcome Animation State with slow smooth fade-out (no moving line)
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // Feedback mode: 'voice' | 'text'
  const [feedbackMode, setFeedbackMode]           = useState<'voice' | 'text' | null>(null);
  const [feedbackText, setFeedbackText]           = useState('');
  const [selectedQuickReview, setSelectedQuickReview] = useState<string | null>(null);

  // Voice state
  const [rawTranscript, setRawTranscript]         = useState('');
  const [cleanedText, setCleanedText]             = useState('');
  const [selectedLang, setSelectedLang]           = useState('en-IN');

  // Load visit details
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const found = await db.getVisitByToken(token);
        if (found) {
          setVisit(found);
          if (!patientName && found.patient?.name) {
            setPatientName(found.patient.name);
          }
        }
      } catch (err) {
        console.error('Error loading visit:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  // Handle Welcome Animation Timer: appears gracefully, then slowly fades out
  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setShowWelcomeScreen(false);
      }, 1000); // 1-second smooth slow fade-out transition
    }, 4000);

    return () => clearTimeout(timer);
  }, [loading]);

  const hospitalName = useMemo(() => {
    return (
      queryHospital ||
      visit?.hospital?.name ||
      'Tambaram Medical Center'
    );
  }, [queryHospital, visit]);

  const hospitalLogo = useMemo(() => {
    return visit?.hospital?.logo || '/tambaram-logo.png';
  }, [visit]);

  const quickPositiveButtons = useMemo(() => [
    {
      id: 'doctors',
      icon: '👨‍⚕️',
      title: 'Great Doctors & Caring Staff',
      desc: 'Caring doctors, kind nurses, and quick consultation',
      text: `The doctors and nursing team at ${hospitalName} were exceptionally caring, attentive, and kind. Quick consultation and wonderful care throughout my visit.`,
    },
    {
      id: 'cleanliness',
      icon: '🏥',
      title: 'Clean Facility & Smooth Process',
      desc: 'Very clean premises, polite reception, and fast service',
      text: `Very clean and hygienic hospital environment at ${hospitalName}. The registration was smooth, staff was courteous, and waiting time was minimal.`,
    },
    {
      id: 'overall',
      icon: '⚡',
      title: 'Prompt Attention & Excellent Care',
      desc: 'Immediate care, transparent support, highly satisfied',
      text: `Immediate attention given by the medical team at ${hospitalName}. Transparent care, polite attendants, and a very positive experience overall. Highly recommended!`,
    },
  ], [hospitalName]);

  const handleRatingSelect = (selectedStar: number) => {
    setRating(selectedStar);
    setFeedbackMode(null);
    setSelectedQuickReview(null);
    setRawTranscript('');
    setCleanedText('');
    setFeedbackText('');
  };

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

  const handleVoiceSubmit = async () => {
    setSubmitting(true);
    try {
      const activePatientName = patientName.trim() || visit?.patient?.name || 'Valued Patient';
      const activePatientPhone = queryPhone.trim() || visit?.patient?.phone || '';
      const result = await db.submitReview({
        tokenOrId: token,
        rating,
        patientName: activePatientName,
        phone: activePatientPhone,
        hospitalId: visit?.hospital_id,
        hospitalName: hospitalName,
        feedbackType: 'voice',
        voiceTranscript: rawTranscript,
        cleanedReview: cleanedText,
        detectedLanguage: selectedLang,
      });
      const sentRes = analyzeSentimentLocally(cleanedText || '', rating);
      const isEligible = rating >= 4 && sentRes.sentiment === 'positive';

      if (isEligible && cleanedText) {
        await copyToClipboard(cleanedText);
        setRedirectUrl(
          result.redirectUrl ||
          (hospitalName.toLowerCase().includes('tambaram')
            ? TAMBARAM_GOOGLE_REVIEW_URL
            : `https://www.google.com/search?q=${encodeURIComponent(hospitalName + ' Google reviews')}`)
        );
      } else {
        setRedirectUrl(null);
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!feedbackText.trim()) return;
    setSubmitting(true);
    try {
      const activePatientName = patientName.trim() || visit?.patient?.name || 'Valued Patient';
      const activePatientPhone = queryPhone.trim() || visit?.patient?.phone || '';

      // Auto clean/expand with Groq AI in background
      let polishedReview = feedbackText.trim();
      try {
        const cleaned = await cleanWithGroq(feedbackText.trim(), selectedLang);
        if (cleaned && cleaned.trim().length > 10) {
          polishedReview = cleaned.trim();
        }
      } catch (cleanErr) {
        console.warn('Auto Groq cleaning skipped:', cleanErr);
      }

      const result = await db.submitReview({
        tokenOrId: token,
        rating,
        patientName: activePatientName,
        phone: activePatientPhone,
        hospitalId: visit?.hospital_id,
        hospitalName: hospitalName,
        feedbackType: 'text',
        feedbackText: feedbackText.trim(),
        cleanedReview: polishedReview,
      });
      setFinalReviewText(polishedReview);

      const sentRes = analyzeSentimentLocally(polishedReview || '', rating);
      const isEligible = rating >= 4 && sentRes.sentiment === 'positive';

      if (isEligible && polishedReview) {
        await copyToClipboard(polishedReview);
        setRedirectUrl(
          result.redirectUrl ||
          (hospitalName.toLowerCase().includes('tambaram')
            ? TAMBARAM_GOOGLE_REVIEW_URL
            : `https://www.google.com/search?q=${encodeURIComponent(hospitalName + ' Google reviews')}`)
        );
      } else {
        setRedirectUrl(null);
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Failed to submit written feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickSubmit = async (textToSubmit: string) => {
    if (!textToSubmit?.trim()) return;
    setSubmitting(true);
    try {
      const activePatientName = patientName.trim() || visit?.patient?.name || 'Valued Patient';
      const activePatientPhone = queryPhone.trim() || visit?.patient?.phone || '';
      const finalRating = rating > 0 ? rating : 5;

      const result = await db.submitReview({
        tokenOrId: token,
        rating: finalRating,
        patientName: activePatientName,
        phone: activePatientPhone,
        hospitalId: visit?.hospital_id,
        hospitalName: hospitalName,
        feedbackType: 'text',
        feedbackText: textToSubmit.trim(),
        cleanedReview: textToSubmit.trim(),
      });
      setFinalReviewText(textToSubmit.trim());

      const sentRes = analyzeSentimentLocally(textToSubmit.trim(), finalRating);
      const isEligible = finalRating >= 4 && sentRes.sentiment === 'positive';

      if (isEligible && textToSubmit.trim()) {
        await copyToClipboard(textToSubmit.trim());
        setRedirectUrl(
          result.redirectUrl ||
          (hospitalName.toLowerCase().includes('tambaram')
            ? TAMBARAM_GOOGLE_REVIEW_URL
            : `https://www.google.com/search?q=${encodeURIComponent(hospitalName + ' Google reviews')}`)
        );
      } else {
        setRedirectUrl(null);
      }
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert('Failed to submit quick feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 bg-white border border-slate-200 p-8 rounded-3xl shadow-xl text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#003B95]" />
          <p className="text-sm text-slate-700 font-semibold">Connecting to medical center...</p>
        </div>
      </div>
    );
  }

  // ── 1. Welcome Screen Animation (Smooth Slow Fade Out, No Progress Bar Line) ───────
  if (showWelcomeScreen) {
    return (
      <div
        className={`min-h-screen bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/60 flex items-center justify-center p-4 sm:p-6 overflow-hidden relative transition-all duration-1000 ease-in-out ${
          isFadingOut ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}
      >
        {/* Soft ambient background */}
        <div className="absolute w-96 h-96 bg-blue-200/40 rounded-full blur-3xl -top-20 -left-20 pointer-events-none" />
        <div className="absolute w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl -bottom-20 -right-20 pointer-events-none" />

        <div className="max-w-md w-full bg-white border border-blue-100 rounded-3xl p-8 sm:p-9 shadow-[0_20px_60px_-15px_rgba(0,59,149,0.12)] text-center relative z-10 animate-in fade-in zoom-in-95 duration-500">
          
          {/* Medical Center Logo */}
          <div className="relative mx-auto w-20 h-20 mb-5 flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-white p-2.5 shadow-md border-2 border-blue-100 flex items-center justify-center">
              <img
                src={hospitalLogo}
                alt={hospitalName}
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="hidden items-center justify-center w-full h-full text-[#003B95]">
                <HospitalIcon className="w-10 h-10" />
              </div>
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#003B95] text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Official Patient Experience</span>
          </div>

          <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-4">
            {hospitalName}
          </h1>

          {/* Welcoming Text */}
          <div className="space-y-2">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
              We’d love to hear about your experience with us.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
              Your feedback means a lot to us and helps us serve you better.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Post-Review Success Screen (Light Theme) ─────────────────────────────
  if (submitted) {
    const sentimentResult = analyzeSentimentLocally(finalReviewText || '', rating);
    const isGoogleReviewEligible = rating >= 4 && sentimentResult.sentiment === 'positive';

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/70 via-slate-50 to-indigo-50/50 flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-[0_20px_50px_rgba(0,59,149,0.1)] p-8 text-center animate-in fade-in zoom-in duration-300">
          {isGoogleReviewEligible ? (
            <>
              <div className="w-16 h-16 bg-blue-50 text-[#003B95] rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm border border-blue-100">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Thank You for Sharing Your Feedback</h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                We truly appreciate you taking the time to share your experience. Your feedback has been received and will be reviewed by our Medical Director and patient relations team.
              </p>

              {finalReviewText && (
                <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 mb-6 text-left">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-[#003B95] flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> Your Review Feedback
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(finalReviewText)}
                      className="text-[11px] text-[#003B95] hover:underline font-bold flex items-center gap-1 cursor-pointer bg-white px-2 py-0.5 rounded-md border border-blue-200 shadow-xs"
                    >
                      <ClipboardCheck className="w-3 h-3" />
                      <span>Copy Text</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-800 italic leading-relaxed font-sans bg-white/80 p-2.5 rounded-xl border border-blue-100">
                    "{finalReviewText}"
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-blue-900 font-semibold bg-blue-100/70 px-2.5 py-1.5 rounded-lg">
                    <ClipboardCheck className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>Review copied to clipboard! Simply paste (Ctrl+V / Long Press) on Google Reviews.</span>
                  </div>
                </div>
              )}

              {(() => {
                const targetUrl =
                  redirectUrl && redirectUrl.includes('#sv=')
                    ? redirectUrl
                    : (hospitalName.toLowerCase().includes('tambaram') || !redirectUrl
                        ? TAMBARAM_GOOGLE_REVIEW_URL
                        : redirectUrl);
                return (
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (finalReviewText) {
                        copyToClipboard(finalReviewText);
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#003B95] hover:bg-[#002b6e] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-blue-900/20 transition-all text-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span>Post on Google Reviews</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                );
              })()}
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm border border-amber-200">
                <HeartHandshake className="w-9 h-9" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">
                {sentimentResult.sentiment === 'negative' || rating <= 2
                  ? 'We Sincerely Apologize'
                  : 'Thank You for Sharing Your Feedback'}
              </h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                {sentimentResult.sentiment === 'negative' || rating <= 2
                  ? 'We sincerely apologize for your experience and appreciate you bringing this to our attention. We are reviewing your feedback and taking steps to improve our services so that this does not happen again.'
                  : 'Thank you for sharing your feedback with us. We have carefully noted your suggestions and will continue working to improve your experience and our services.'}
              </p>
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 text-left">
                <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-950">
                  <ShieldCheck className="w-4 h-4 text-amber-600" /> Direct Care Review Logged
                </p>
                <p className="text-slate-600 leading-normal">
                  Our patient relations lead will review your comments and reach out to address your concerns.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── 3. Main Feedback 3D Card (Header like Image 2, Clean Text Below) ────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/70 via-slate-50 to-indigo-50/50 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      
      {/* 3D Card Container */}
      <div className="max-w-xl w-full mx-auto my-auto transition-all duration-300">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_20px_50px_rgba(0,59,149,0.08),0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden">
          
          {/* Hospital Header Banner (Compact & Sleek matching Image 2) */}
          <div className="bg-gradient-to-r from-[#003B95] via-[#002d73] to-[#001f52] px-6 py-4.5 text-white relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-white p-1.5 shadow-sm flex items-center justify-center shrink-0 border border-white/20 overflow-hidden">
                  <img
                    src={hospitalLogo}
                    alt={hospitalName}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="hidden items-center justify-center w-full h-full text-[#003B95]">
                    <HospitalIcon className="w-5 h-5" />
                  </div>
                </div>

                <div className="min-w-0">
                  <h1 className="font-bold text-base sm:text-lg tracking-tight text-white leading-tight truncate">
                    {hospitalName}
                  </h1>
                  <p className="text-[11px] sm:text-xs text-blue-200 font-medium">
                    Patient Feedback & Care Portal
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 text-white px-2.5 py-1 rounded-full border border-white/25 shrink-0">
                Verified Visit
              </span>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Clean Welcoming Header (No Boxy Card) */}
            <div className="text-center pt-1 space-y-1">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                We’d love to hear about your experience with us.
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                Your feedback means a lot to us and helps us serve you better.
              </p>
            </div>

            {/* Step 1: Patient Name Input Card (Clean styling matching Image 2) */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2 focus-within:ring-2 focus-within:ring-[#003B95] focus-within:bg-white focus-within:border-transparent transition-all">
              <label htmlFor="patientName" className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <User className="w-4 h-4 text-[#003B95]" />
                <span>Patient Name</span> <span className="text-red-500">*</span>
              </label>
              <input
                id="patientName"
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-[#003B95] shadow-xs"
              />
              <p className="text-[11px] text-slate-500">
                This name will be saved with your review in the clinic database.
              </p>
            </div>

            {/* Step 2: 3D Star Rating */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm text-center space-y-4">
              <StarRating rating={rating} onRatingSelect={handleRatingSelect} />

              {/* Three Quick Positive Review Buttons - Only Text */}
              <div className="pt-4 border-t border-slate-100 text-left space-y-2.5">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Quick Reviews
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {quickPositiveButtons.map((btn) => {
                    const isSelected = selectedQuickReview === btn.text;
                    return (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => {
                          setSelectedQuickReview(btn.text);
                          setFeedbackText(btn.text);
                          if (rating === 0) setRating(5);
                        }}
                        className={`w-full px-4 py-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-[#003B95] text-white border-[#003B95] shadow-sm'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {btn.title}
                      </button>
                    );
                  })}
                </div>

                {/* Instant Submit Button for Selected Quick Review */}
                {selectedQuickReview && (
                  <div className="pt-1 animate-in fade-in duration-200">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleQuickSubmit(selectedQuickReview)}
                      className="w-full py-3 px-4 bg-gradient-to-r from-[#003B95] via-[#002d73] to-[#001f52] hover:opacity-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-950/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting Feedback...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Selected Review Now 🚀</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Choose Feedback Mode & Submit */}
            {rating > 0 && (
              <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
                {!feedbackMode && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-200" />
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
                        Or speak / type custom feedback
                      </p>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Voice Record 3D Button */}
                      <button
                        type="button"
                        onClick={() => setFeedbackMode('voice')}
                        className="flex flex-col items-center gap-2.5 p-4 sm:p-5 rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-blue-100/40 hover:from-blue-100 hover:to-blue-200/50 text-[#003B95] transition-all font-bold text-xs group shadow-sm hover:shadow-md cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-[#003B95] text-white flex items-center justify-center shadow-md shadow-blue-900/20 group-hover:scale-110 transition-transform">
                          <Mic className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">Voice Record</span>
                        <span className="text-[11px] text-blue-700 font-normal">Speak in your language</span>
                      </button>

                      {/* Type Feedback 3D Button */}
                      <button
                        type="button"
                        onClick={() => setFeedbackMode('text')}
                        className="flex flex-col items-center gap-2.5 p-4 sm:p-5 rounded-2xl border-2 border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/60 hover:from-slate-100 hover:to-slate-200/60 text-slate-800 transition-all font-bold text-xs group shadow-sm hover:shadow-md cursor-pointer"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-md shadow-slate-900/20 group-hover:scale-110 transition-transform">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <span className="text-sm font-bold text-slate-900">Type Feedback</span>
                        <span className="text-[11px] text-slate-500 font-normal">Write text review</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Voice Mode Container */}
                {feedbackMode === 'voice' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[#003B95] flex items-center gap-1.5">
                        <Mic className="w-4 h-4" /> Voice Feedback
                      </span>
                      <button
                        type="button"
                        onClick={() => setFeedbackMode('text')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                      >
                        Switch to Text
                      </button>
                    </div>

                    <VoiceRecorder
                      selectedLang={selectedLang}
                      onLanguageChange={setSelectedLang}
                      rawTranscript={rawTranscript}
                      setRawTranscript={setRawTranscript}
                      cleanedText={cleanedText}
                      setCleanedText={setCleanedText}
                      onSubmit={handleVoiceSubmit}
                      submitting={submitting}
                    />
                  </div>
                )}

                {/* Text Mode Container */}
                {feedbackMode === 'text' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                        <MessageSquare className="w-4 h-4 text-[#003B95]" />
                        <span>Written Text Review</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFeedbackMode('voice')}
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                      >
                        Switch to Voice
                      </button>
                    </div>

                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Share your experience regarding consultation, doctors, staff hospitality, waiting time..."
                      rows={4}
                      className="w-full text-sm text-slate-900 bg-white p-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#003B95] shadow-xs leading-relaxed"
                    />

                    {/* Quick Sentiment Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {['Fast service', 'Caring doctors', 'Friendly staff', 'Clean clinic', 'Good consultation'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setFeedbackText((prev) => prev ? `${prev} ${tag}.` : `${tag}.`)}
                          className="text-[11px] bg-white border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg hover:border-blue-300 hover:text-[#003B95] transition-colors cursor-pointer"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleTextSubmit}
                      disabled={submitting || !feedbackText.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 bg-[#003B95] hover:bg-[#002b6e] text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-900/25 transition-all text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Submit Patient Review</span>
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Footer */}
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500">
            <span className="font-semibold text-slate-600">
              Powered by Nayaruvi
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
