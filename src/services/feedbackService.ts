/**
 * feedbackService.ts
 *
 * Real feedback service connected to the database & review pipeline.
 * Only genuine patient reviews submitted via WhatsApp or the review landing page
 * are tracked and displayed. No hardcoded or dummy reviews are shown.
 */

import type {
  Feedback,
  FeedbackResponse,
  FeedbackStats,
  FollowUpStatus,
  SentimentType,
  SubmitFeedbackPayload,
} from '../types/feedback';
import { db } from './db';
import {
  analyzeSentimentLocally,
  analyzeFeedbackWithAI,
} from './sentimentAnalysisService';

// Simulate minimal network latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Session store for reviews submitted during live testing
let feedbackStore: Feedback[] = [];

// ---------------------------------------------------------------------------
// Submit new feedback from the patient (via public review flow)
// ---------------------------------------------------------------------------
export async function submitFeedback(
  payload: SubmitFeedbackPayload,
  hospitalId?: string
): Promise<FeedbackResponse> {
  await delay(400);

  const id = `fb-${Date.now()}`;
  const rawText = payload.originalFeedback ?? payload.voiceTranscript ?? '';

  let activeHospitalId = hospitalId;
  if (!activeHospitalId) {
    try {
      const activeUser = JSON.parse(localStorage.getItem('rb_active_user') || '{}');
      activeHospitalId = activeUser?.hospital_id || localStorage.getItem('rb_selected_hospital_id') || undefined;
    } catch {}
  }

  const analysis = analyzeSentimentLocally(rawText, payload.rating);
  const isGoogleEligible = payload.rating >= 4 && analysis.sentiment === 'positive';
  const patientPhone = payload.phone || 'Phone not provided';
  const patientDisplayName = payload.patientName || 'Valued Patient';

  const newRecord: Feedback = {
    id,
    hospitalId: activeHospitalId,
    patientName: patientDisplayName,
    maskedPhone: patientPhone,
    phone: patientPhone,
    visitDate: new Date().toISOString().slice(0, 10),
    visitId: `VIS-${Date.now().toString().slice(-5)}`,
    rating: payload.rating,
    sentiment: analysis.sentiment,
    sentimentScore: analysis.score,
    healthcareTopic: analysis.topic,
    aiSuggestedSolution: analysis.solution,
    patientResponseMessage: analysis.patientResponseMessage,
    originalFeedback: rawText || undefined,
    cleanedReview: rawText || undefined,
    feedbackType: payload.feedbackType,
    transcriptionStatus:
      payload.feedbackType === 'voice' ? 'completed' : 'not_required',
    reviewStatus: isGoogleEligible ? 'completed' : 'follow_up_required',
    followUpStatus: isGoogleEligible ? 'none' : 'required',
    channel: 'web',
    feedbackSubmittedAt: new Date().toISOString(),
    whatsappSentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  feedbackStore = [newRecord, ...feedbackStore];

  // Synchronize with database and Firebase RTDB so clinical dashboard updates immediately
  try {
    await db.submitReview({
      tokenOrId: payload.visitId || id,
      rating: payload.rating,
      patientName: patientDisplayName,
      phone: patientPhone,
      hospitalId: activeHospitalId,
      feedbackType: payload.feedbackType,
      feedbackText: rawText || undefined,
      cleanedReview: rawText || undefined,
      voiceTranscript: payload.voiceTranscript,
    });
  } catch (err) {
    console.warn('Failed to sync feedback with db.submitReview:', err);
  }

  return {
    success: true,
    feedbackId: id,
    reviewStatus: newRecord.reviewStatus,
    cleanedReview: rawText || undefined,
    message: isGoogleEligible
      ? "Thank you! We've prepared your feedback for a quick review."
      : 'Thank you for your feedback. Our team will review this and get back to you if needed.',
  };
}

// ---------------------------------------------------------------------------
// Get paginated / filtered feedback list (staff) - Strictly genuine reviews
// ---------------------------------------------------------------------------
export async function getFeedback(params?: {
  search?: string;
  rating?: number | null;
  status?: string;
  sentiment?: string;
  dateFrom?: string;
  dateTo?: string;
  hospitalId?: string;
}): Promise<Feedback[]> {
  await delay(100);

  // 1. Identify active target hospital
  let targetHospitalId = params?.hospitalId;
  if (!targetHospitalId) {
    try {
      const activeUser = JSON.parse(localStorage.getItem('rb_active_user') || '{}');
      targetHospitalId = activeUser?.hospital_id || localStorage.getItem('rb_selected_hospital_id') || undefined;
    } catch {}
  }

  const filterByHospital = Boolean(targetHospitalId && targetHospitalId !== 'all');

  let dbFeedback: Feedback[] = [];
  try {
    const [reviews, visits, patients, hospitals] = await Promise.all([
      db.getReviews(), // Fetch all reviews from Firebase RTDB & local storage
      db.getVisits(filterByHospital ? targetHospitalId : null),
      db.getPatients(filterByHospital ? targetHospitalId : null),
      db.getHospitals(),
    ]);

    const activeHospital = hospitals.find((h) => h.id === targetHospitalId);
    
    // Multi-key lookup indexes
    const visitById = new Map(visits.map((v) => [v.id, v]));
    const visitByToken = new Map(visits.filter((v) => v.token).map((v) => [v.token, v]));
    const visitByUid = new Map(visits.filter((v) => v.visit_uid).map((v) => [v.visit_uid, v]));
    const patientById = new Map(patients.map((p) => [p.id, p]));

    // Map all genuine patient reviews
    if (reviews && reviews.length > 0) {
      reviews
        .filter((r) => typeof r.rating === 'number' && r.rating >= 1 && r.rating <= 5)
        .forEach((req) => {
          // Check if this review belongs to the target hospital
          if (filterByHospital && targetHospitalId) {
            const reqHospitalId = req.hospital_id;
            const reqHospitalName = ((req as any).hospital_name || (req as any).hospital || '').toLowerCase();
            const activeHospitalName = (activeHospital?.name || '').toLowerCase();
            const activeSubdomain = (activeHospital?.subdomain || '').toLowerCase();

            const isDirectMatch =
              reqHospitalId === targetHospitalId ||
              reqHospitalId === activeHospital?.id;

            const isNameMatch =
              Boolean(activeHospitalName && reqHospitalName && (activeHospitalName.includes(reqHospitalName) || reqHospitalName.includes(activeHospitalName)));

            const isSubdomainMatch =
              Boolean(activeSubdomain && reqHospitalId && reqHospitalId.toLowerCase().includes(activeSubdomain));

            if (!isDirectMatch && !isNameMatch && !isSubdomainMatch) {
              return;
            }
          }

          // 1. Resolve Matched Visit
          let matchedVisit =
            (req.visit_id ? (visitById.get(req.visit_id) || visitByToken.get(req.visit_id) || visitByUid.get(req.visit_id)) : undefined) ||
            (req.token ? (visitByToken.get(req.token) || visitById.get(req.token) || visitByUid.get(req.token)) : undefined);

          const rawReqName = ((req as any).patient_name || (req.patient_id && !req.patient_id.includes('-') && !req.patient_id.startsWith('tmc-') ? req.patient_id : '') || '').trim();
          const normReqName = rawReqName.toLowerCase();

          if (!matchedVisit && normReqName && normReqName !== 'valued patient' && normReqName !== 'anonymous patient') {
            matchedVisit = visits.find((v) => {
              const vPatName = (v.patient?.name || '').trim().toLowerCase();
              return vPatName && (vPatName === normReqName || vPatName.includes(normReqName) || normReqName.includes(vPatName));
            });
          }

          // 2. Resolve Matched Patient
          let matchedPatient =
            (matchedVisit?.patient_id ? patientById.get(matchedVisit.patient_id) : undefined) ||
            (matchedVisit?.patient ? matchedVisit.patient : undefined) ||
            (req.patient_id ? patientById.get(req.patient_id) : undefined);

          if (!matchedPatient && normReqName && normReqName !== 'valued patient' && normReqName !== 'anonymous patient') {
            matchedPatient = patients.find((p) => {
              const pName = (p.name || '').trim().toLowerCase();
              return pName && (pName === normReqName || pName.includes(normReqName) || normReqName.includes(pName));
            });
          }

          // 3. Determine Patient Name
          let patientName =
            rawReqName ||
            matchedPatient?.name ||
            matchedVisit?.patient?.name ||
            'Valued Patient';

          // 4. Determine Patient Phone
          let rawReqPhone =
            (req as any).phone ||
            (req as any).phone_number ||
            (req as any).patient_phone ||
            (req as any).mobile ||
            matchedPatient?.phone ||
            matchedVisit?.patient?.phone ||
            '';

          // If phone was missing or dummy in old record, find from patients/visits matching this patient name
          if (!rawReqPhone || rawReqPhone === '+91 98765 43210' || rawReqPhone === '+919876543210' || rawReqPhone.toLowerCase().includes('not provided')) {
            if (normReqName && normReqName !== 'valued patient' && normReqName !== 'anonymous patient') {
              const patByName = patients.find((p) => {
                const pName = (p.name || '').trim().toLowerCase();
                return pName && (pName === normReqName || pName.includes(normReqName) || normReqName.includes(pName));
              });
              if (patByName?.phone && patByName.phone !== '+91 98765 43210' && patByName.phone !== '+919876543210') {
                rawReqPhone = patByName.phone;
              } else {
                const visByName = visits.find((v) => {
                  const vPatName = (v.patient?.name || '').trim().toLowerCase();
                  return vPatName && (vPatName === normReqName || vPatName.includes(normReqName) || normReqName.includes(vPatName));
                });
                if (visByName?.patient?.phone && visByName.patient.phone !== '+91 98765 43210' && visByName.patient.phone !== '+919876543210') {
                  rawReqPhone = visByName.patient.phone;
                }
              }
            }
          }

          let patientPhone = rawReqPhone && rawReqPhone !== '+91 98765 43210' && rawReqPhone !== '+919876543210' && !rawReqPhone.toLowerCase().includes('not provided')
            ? rawReqPhone
            : (matchedPatient?.phone || matchedVisit?.patient?.phone || 'Phone not provided');

          // Determine Visit Date & ID
          const visitDate =
            matchedVisit?.visit_date ||
            (req.submitted_at ? req.submitted_at.slice(0, 10) : new Date().toISOString().slice(0, 10));
          const visitId =
            matchedVisit?.visit_uid ||
            req.token ||
            req.visit_id ||
            (req.id ? `REV-${req.id.slice(-6)}` : `REV-${Date.now().toString().slice(-4)}`);

          const rating = Number(req.rating);
          const isPositive = rating >= 4;

          // Parse voice meta if available in message_template
          let cleanedReview = req.feedback_text || undefined;
          let feedbackType: 'text' | 'voice' = (req.review_channel as any) === 'voice' ? 'voice' : 'text';
          if (req.message_template && req.message_template.startsWith('{')) {
            try {
              const meta = JSON.parse(req.message_template);
              if (meta.feedbackType === 'voice') {
                feedbackType = 'voice';
                cleanedReview = meta.cleanedReview || meta.voiceTranscript || req.feedback_text || undefined;
              }
            } catch {}
          }

          const textForAnalysis = cleanedReview || req.feedback_text || '';
          const analysis = analyzeSentimentLocally(textForAnalysis, rating);

          dbFeedback.push({
            id: req.id || `fb-${req.visit_id || Date.now()}`,
            hospitalId: req.hospital_id || matchedVisit?.hospital_id || targetHospitalId,
            patientName,
            phone: patientPhone,
            maskedPhone: patientPhone,
            visitDate,
            visitId,
            rating,
            sentiment: analysis.sentiment,
            sentimentScore: analysis.score,
            healthcareTopic: analysis.topic,
            aiSuggestedSolution: analysis.solution,
            patientResponseMessage: analysis.patientResponseMessage,
            originalFeedback: req.feedback_text || undefined,
            cleanedReview,
            feedbackType,
            transcriptionStatus: feedbackType === 'voice' ? 'completed' : 'not_required',
            reviewStatus: isPositive ? ('completed' as const) : ('follow_up_required' as const),
            followUpStatus: isPositive ? ('none' as const) : ('required' as const),
            channel: (req.review_channel as any) || 'web',
            feedbackSubmittedAt: req.submitted_at || req.created_at || new Date().toISOString(),
            whatsappSentAt: req.sent_at || req.created_at || new Date().toISOString(),
            createdAt: req.created_at || new Date().toISOString(),
          });
        });
    }
  } catch (err) {
    console.warn('Could not load reviews for feedback list:', err);
  }

  // Session feedbacks submitted via submitFeedback
  const sessionFeedbacks = feedbackStore.filter((f) => {
    if (!filterByHospital) return true;
    return f.hospitalId === targetHospitalId;
  });

  // Combine real DB feedbacks and session feedbacks (avoiding duplicates by id)
  const seenIds = new Set<string>();
  const combined: Feedback[] = [];
  [...dbFeedback, ...sessionFeedbacks].forEach((item) => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      combined.push({
        ...item,
        phone: item.phone || item.maskedPhone,
        maskedPhone: item.phone || item.maskedPhone,
      });
    }
  });

  // Sort by latest submission/creation date descending
  combined.sort((a, b) => {
    const dateA = new Date(a.feedbackSubmittedAt || a.createdAt).getTime();
    const dateB = new Date(b.feedbackSubmittedAt || b.createdAt).getTime();
    return dateB - dateA;
  });

  let results = [...combined];

  if (params?.search) {
    const q = params.search.toLowerCase();
    results = results.filter(
      (f) =>
        f.patientName.toLowerCase().includes(q) ||
        f.visitId.toLowerCase().includes(q) ||
        (f.phone && f.phone.includes(q)) ||
        (f.originalFeedback && f.originalFeedback.toLowerCase().includes(q)) ||
        (f.healthcareTopic && f.healthcareTopic.toLowerCase().includes(q))
    );
  }

  if (params?.rating != null) {
    results = results.filter((f) => f.rating === params.rating);
  }

  if (params?.sentiment && params.sentiment !== 'all') {
    results = results.filter((f) => f.sentiment === params.sentiment);
  }

  if (params?.status && params.status !== 'all') {
    results = results.filter((f) => f.reviewStatus === params.status);
  }

  if (params?.dateFrom) {
    results = results.filter((f) => f.visitDate >= params.dateFrom!);
  }

  if (params?.dateTo) {
    results = results.filter((f) => f.visitDate <= params.dateTo!);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Get a single feedback record by ID
// ---------------------------------------------------------------------------
export async function getFeedbackById(id: string): Promise<Feedback | null> {
  const allFeedbacks = await getFeedback();
  const found = allFeedbacks.find((f) => f.id === id) || feedbackStore.find((f) => f.id === id);
  if (!found) return null;

  // If Negative/Neutral, enrich with deep AI solution if not already present
  if ((found.sentiment === 'negative' || found.sentiment === 'neutral' || found.rating <= 3) && !found.aiSuggestedSolution) {
    try {
      const aiRes = await analyzeFeedbackWithAI(found.originalFeedback || found.cleanedReview || '', found.rating);
      found.sentiment = aiRes.sentiment;
      found.healthcareTopic = aiRes.topic;
      found.aiSuggestedSolution = aiRes.solution;
    } catch {}
  }

  return found;
}

// ---------------------------------------------------------------------------
// Update the follow-up status (staff action)
// ---------------------------------------------------------------------------
export async function updateFollowUpStatus(
  id: string,
  status: FollowUpStatus
): Promise<boolean> {
  await delay(300);
  const idx = feedbackStore.findIndex((f) => f.id === id);
  if (idx !== -1) {
    feedbackStore[idx] = { ...feedbackStore[idx], followUpStatus: status };
  }
  return true;
}

// ---------------------------------------------------------------------------
// Record that the patient opened the review link
// ---------------------------------------------------------------------------
export async function markReviewOpened(id: string): Promise<boolean> {
  await delay(100);
  const idx = feedbackStore.findIndex((f) => f.id === id);
  if (idx !== -1) {
    feedbackStore[idx] = {
      ...feedbackStore[idx],
      reviewStatus: 'redirected',
      reviewOpenedAt: new Date().toISOString(),
    };
  }
  return true;
}

// ---------------------------------------------------------------------------
// Record that the patient completed the Google review
// ---------------------------------------------------------------------------
export async function markReviewCompleted(id: string): Promise<boolean> {
  await delay(100);
  const idx = feedbackStore.findIndex((f) => f.id === id);
  if (idx !== -1) {
    feedbackStore[idx] = {
      ...feedbackStore[idx],
      reviewStatus: 'completed',
      reviewCompletedAt: new Date().toISOString(),
    };
  }
  return true;
}

// ---------------------------------------------------------------------------
// Dashboard statistics calculated dynamically from genuine reviews
// ---------------------------------------------------------------------------
export async function getFeedbackStats(hospitalId?: string): Promise<FeedbackStats> {
  await delay(100);
  const feedbacks = await getFeedback({ hospitalId });
  const total = feedbacks.length;
  if (total === 0) {
    return {
      totalVisits: 0,
      requestsSent: 0,
      responsesReceived: 0,
      googleReviewsCompleted: 0,
      followUpsRequired: 0,
      responseRate: 0,
      conversionRate: 0,
    };
  }

  const followUpCount = feedbacks.filter((f) => f.followUpStatus === 'required').length;
  const googleCompleted = feedbacks.filter((f) => f.reviewStatus === 'completed').length;

  return {
    totalVisits: total,
    requestsSent: total,
    responsesReceived: total,
    googleReviewsCompleted: googleCompleted,
    followUpsRequired: followUpCount,
    responseRate: 100,
    conversionRate: Math.round((googleCompleted / total) * 100),
  };
}

// ---------------------------------------------------------------------------
// Delete feedback records
// ---------------------------------------------------------------------------
export async function deleteFeedback(feedbackId: string): Promise<boolean> {
  const cleanId = (feedbackId || '').trim();
  feedbackStore = feedbackStore.filter(
    (f) => f.id !== cleanId && f.visitId !== cleanId
  );
  return db.deleteReview(cleanId);
}

export async function deleteAllFeedback(hospitalId?: string): Promise<boolean> {
  if (hospitalId) {
    feedbackStore = feedbackStore.filter((f) => f.hospitalId !== hospitalId);
  } else {
    feedbackStore = [];
  }
  return db.deleteAllReviews(hospitalId);
}
