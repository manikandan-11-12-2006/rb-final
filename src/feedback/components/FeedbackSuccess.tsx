import { CheckCircle2, ExternalLink, Sparkles, ClipboardCheck, HeartHandshake, ShieldCheck } from 'lucide-react';
import { analyzeSentimentLocally } from '../../services/sentimentAnalysisService';

interface FeedbackSuccessProps {
  rating: number;
  hospitalName: string;
  finalReviewText: string;
  clipboardCopied: boolean;
  redirectUrl: string | null;
}

export const FeedbackSuccess: React.FC<FeedbackSuccessProps> = ({
  rating,
  hospitalName,
  finalReviewText,
  clipboardCopied,
  redirectUrl,
}) => {
  const sentimentResult = analyzeSentimentLocally(finalReviewText || '', rating);
  const isHigh = rating >= 4 && sentimentResult.sentiment === 'positive';

  return (
    <div className="min-h-screen bg-slate-50/80 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden p-8 text-center animate-in fade-in zoom-in duration-300">
        {isHigh ? (
          <>
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-5 text-primary-600 shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Thank You for Your Feedback!</h2>
            <p className="text-sm text-slate-700 mb-6 leading-relaxed">
              ❤️ <strong className="font-semibold text-slate-900">You’re just one step away!</strong> Your words could make a difference to someone. Kindly share your experience on Google Reviews - it’s already copied and ready to paste! 💖
            </p>

            {finalReviewText && (
              <div className="bg-primary-50/70 border border-primary-200/80 rounded-2xl p-4 mb-6 text-left">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-primary-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-primary-600" /> AI Prepared Review
                  </span>
                </div>
                <p className="text-xs text-slate-700 italic leading-relaxed font-sans">
                  "{finalReviewText}"
                </p>
                {clipboardCopied && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-primary-700 font-semibold bg-primary-100/60 px-2.5 py-1 rounded-md">
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Copied to clipboard! Ready to paste on Google Reviews.</span>
                  </div>
                )}
              </div>
            )}

            {redirectUrl && (
              <a
                href={redirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  try {
                    const fbBase = ((import.meta as any).env?.VITE_FIREBASE_DATABASE_URL || 'https://rescuebridge-fe59b-default-rtdb.firebaseio.com').replace(/\/+$/, '');
                    const urlParams = new URLSearchParams(window.location.search);
                    const tokenParam = urlParams.get('token') || '';
                    const patientName = urlParams.get('patient') || urlParams.get('name') || '';
                    const phoneParam = urlParams.get('phone') || urlParams.get('phone_number') || '';
                    const hospitalParam = urlParams.get('hospital') || hospitalName;

                    const gPayload = {
                      id: `gclick-${Date.now()}`,
                      visit_id: tokenParam || (`visit-${Date.now()}`),
                      token: tokenParam,
                      patient_id: patientName || 'Google Reviewer',
                      patient_name: patientName || 'Google Reviewer',
                      phone: phoneParam,
                      phone_number: phoneParam,
                      hospital_name: hospitalParam,
                      rating: Number(rating) || 5,
                      feedback_text: finalReviewText || 'Submitted 5-star Google Review',
                      sentiment: 'positive',
                      healthcare_topic: 'Google Verified Review',
                      status: 'completed',
                      review_channel: 'google_review',
                      google_review_posted: true,
                      is_google_review: true,
                      whatsapp_status: 'read',
                      submitted_at: new Date().toISOString(),
                    };

                    fetch(`${fbBase}/review_requests.json`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(gPayload),
                    }).catch(() => {});

                    // Patch matching patient in Firebase RTDB
                    fetch(`${fbBase}/patients.json`)
                      .then((r) => r.json())
                      .then((allPatients: any) => {
                        if (!allPatients) return;
                        const cleanPhone = phoneParam.replace(/\D/g, '').slice(-10);
                        const cleanName = patientName.toLowerCase().trim();
                        for (const [key, p] of Object.entries(allPatients) as [string, any][]) {
                          if (!p) continue;
                          const pPh = (p.phone || '').replace(/\D/g, '').slice(-10);
                          const pNm = (p.name || '').toLowerCase().trim();
                          const phoneMatches = Boolean(cleanPhone && pPh === cleanPhone);
                          const nameMatches = Boolean(cleanName && pNm && (pNm === cleanName || pNm.includes(cleanName) || cleanName.includes(pNm)));
                          const isMatch = (cleanName && cleanName !== 'anonymous patient' && cleanName !== 'valued patient')
                            ? (phoneMatches && nameMatches) || (nameMatches && !cleanPhone)
                            : phoneMatches;
                          if (isMatch) {
                            fetch(`${fbBase}/patients/${encodeURIComponent(key)}.json`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                rating: Number(rating) || 5,
                                review_status: 'completed',
                                review_sent: true,
                                review_channel: 'google_review',
                                google_review_posted: true,
                                is_google_review: true,
                                review_submitted_at: new Date().toISOString(),
                              }),
                            }).catch(() => {});
                            break;
                          }
                        }
                      }).catch(() => {});

                    // Patch matching visit in Firebase RTDB
                    fetch(`${fbBase}/visits.json`)
                      .then((r) => r.json())
                      .then((allVisits: any) => {
                        if (!allVisits) return;
                        for (const [key, v] of Object.entries(allVisits) as [string, any][]) {
                          if (!v) continue;
                          if (tokenParam && (v.token === tokenParam || key === tokenParam)) {
                            fetch(`${fbBase}/visits/${encodeURIComponent(key)}.json`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                status: 'completed',
                                rating: Number(rating) || 5,
                                is_reviewed: true,
                                review_requested: true,
                              }),
                            }).catch(() => {});
                            break;
                          }
                        }
                      }).catch(() => {});
                  } catch {}
                }}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-primary-600/20 transition-all text-sm"
              >
                <span>Post on Google Reviews</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-5 text-amber-600 shadow-inner">
              <HeartHandshake className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              {sentimentResult.sentiment === 'negative' || rating <= 2 ? 'We Sincerely Apologize' : 'Thank You for Sharing Your Feedback'}
            </h2>
            <p className="text-sm text-slate-700 mb-6 leading-relaxed">
              {sentimentResult.sentiment === 'negative' || rating <= 2
                ? 'We sincerely apologize for your experience and appreciate you bringing this to our attention. We are reviewing your feedback and taking steps to improve our services so that this does not happen again.'
                : 'Thank you for sharing your feedback with us. We have carefully noted your suggestions and will continue working to improve your experience and our services.'}
            </p>
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-800 text-left">
              <p className="font-semibold flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-4 h-4 text-amber-600" /> Direct Care Review Logged
              </p>
              <p className="text-slate-600 leading-normal">
                Our patient relations team and Medical Director review all comments to ensure continuous quality improvement.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
