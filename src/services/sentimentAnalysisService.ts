/**
 * sentimentAnalysisService.ts
 *
 * Full Step-by-Step NLP & LLM-Style Sentiment Analysis Engine
 *
 * Step 1: Preprocess text (clean punctuation, normalize contractions & lowercase)
 * Step 2: Tokenization (tokenize into word tokens and n-grams)
 * Step 3: Intensity & Negation Analysis (process "very", "really", "not", "never")
 * Step 4: Valence & Probability Calculation (Positive, Neutral, Negative distributions)
 * Step 5: Aspect / Topic Extraction
 * Step 6: AI Corrective Solution Generation for Negative & Neutral feedback
 */

import type { SentimentType } from '../types/feedback';

export interface SentimentAnalysisResult {
  sentiment: SentimentType;
  score: number;
  topic: string;
  solution?: string;
  patientResponseMessage?: string;
  probabilities?: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export const PATIENT_RESPONSE_MESSAGES: Record<SentimentType, string> = {
  positive:
    'Your kind words mean the world to our doctors and care team! By sharing your experience on Google, you help other families find trusted healthcare when they need it most. We’ve already copied your review below — simply tap below and paste in 5 seconds!',
  neutral:
    'Thank you for sharing your feedback with us. We have carefully noted your suggestions and will continue working to improve your experience and our services.',
  negative:
    'We sincerely apologize for your experience and appreciate you bringing this to our attention. We are reviewing your feedback and taking steps to improve our services so that this does not happen again.',
};

export function getPatientResponseMessage(
  sentiment: SentimentType,
  patientName?: string,
  hospitalName?: string
): string {
  const baseMessage =
    PATIENT_RESPONSE_MESSAGES[sentiment] || PATIENT_RESPONSE_MESSAGES.neutral;
  const salutation =
    patientName &&
    patientName !== 'Anonymous Patient' &&
    patientName !== 'Valued Patient'
      ? `Dear ${patientName},\n\n`
      : 'Hello,\n\n';
  const signoff = hospitalName
    ? `\n\n— Best regards,\n${hospitalName}`
    : '\n\n— Best regards,\nPatient Care & Medical Relations Team';
  return `${salutation}${baseMessage}${signoff}`;
}

const GROQ_API_KEY =
  (import.meta as any).env?.VITE_GROQ_API_KEY || '';

// ── NLP Token Valence Dictionaries ──
const POSITIVE_WORDS: Record<string, number> = {
  // High positive (score 3.0 to 4.0)
  excellent: 3.8,
  exceptional: 4.0,
  outstanding: 3.9,
  superb: 3.8,
  wonderful: 3.7,
  fantastic: 3.8,
  brilliant: 3.7,
  amazing: 3.8,
  lifesaver: 4.0,
  delighted: 3.6,
  pleased: 3.4,
  enjoyed: 3.5,
  loved: 3.8,
  love: 3.6,
  perfect: 3.9,
  flawless: 3.8,
  satisfaction: 3.2,
  satisfied: 3.4,

  // Solid positive (score 2.0 to 3.0)
  great: 3.0,
  good: 2.2,
  liked: 2.8,
  like: 2.5,
  caring: 3.0,
  helpful: 2.8,
  friendly: 2.8,
  courteous: 2.9,
  polite: 2.7,
  cooperative: 2.6,
  professional: 2.9,
  smooth: 2.7,
  fast: 2.5,
  quick: 2.5,
  prompt: 2.8,
  efficient: 2.9,
  safe: 2.8,
  clean: 2.7,
  neat: 2.6,
  hygienic: 2.8,
  relief: 3.0,
  cured: 3.2,
  recommend: 3.2,
  recommended: 3.4,
  thanks: 2.5,
  thank: 2.5,
  appreciate: 2.8,
  appreciated: 3.0,
  blessed: 3.0,
  transparent: 2.7,
  comfortable: 2.8,
  best: 3.4,
  nice: 2.3,
  fine: 1.8,
};

const NEGATIVE_WORDS: Record<string, number> = {
  // Severe negative (score -3.0 to -4.0)
  worst: -4.0,
  pathetic: -3.8,
  terrible: -3.9,
  horrible: -3.9,
  awful: -3.7,
  disaster: -3.8,
  loot: -4.0,
  looting: -4.0,
  cheated: -3.9,
  cheat: -3.8,
  scam: -4.0,
  hopeless: -3.7,
  negligent: -4.0,
  negligence: -4.0,
  harassed: -3.8,
  harassment: -3.8,

  // Solid negative (score -2.0 to -3.0)
  dissatisfied: -3.2,
  dissatisfaction: -3.0,
  dislike: -3.0,
  disliked: -3.0,
  unhappy: -3.0,
  displeased: -2.9,
  complaint: -2.8,
  complaints: -2.8,
  unfriendly: -3.0,
  hate: -3.5,
  hated: -3.5,
  bad: -2.8,
  poor: -2.8,
  rude: -3.2,
  arrogant: -3.0,
  unprofessional: -3.0,
  unhygienic: -3.2,
  dirty: -2.8,
  pain: -2.5,
  suffering: -2.8,
  complication: -2.8,
  complications: -2.9,
  waste: -3.0,
  useless: -3.0,
  disappointed: -3.0,
  disappointing: -2.9,
  frustrating: -2.8,
  frustrated: -2.8,
  annoying: -2.6,
  delay: -2.4,
  delayed: -2.5,
  overcharged: -3.2,
  expensive: -2.2,
  clueless: -2.8,
  mistake: -2.7,
  wrong: -2.6,
  careless: -3.0,
  slow: -2.0,
  late: -2.0,
};

const INTENSIFIERS: Record<string, number> = {
  very: 1.4,
  really: 1.4,
  extremely: 1.7,
  highly: 1.6,
  truly: 1.4,
  fully: 1.4,
  completely: 1.5,
  absolutely: 1.6,
  super: 1.5,
  so: 1.3,
  too: 1.3,
};

const NEGATIONS = new Set([
  'not',
  'no',
  'never',
  'neither',
  'nor',
  'hardly',
  'barely',
  'scarcely',
  'wasnt',
  "wasn't",
  'isnt',
  "isn't",
  'arent',
  "aren't",
  'dont',
  "don't",
  'didnt',
  "didn't",
  'cant',
  "can't",
  'without',
]);

// ── Aspect & Clinical Pattern Lexicon ──
const TOPIC_RULES = [
  {
    topic: 'Wait Time & Queue Management',
    pattern: /\b(wait|waiting|hour|delayed?|late|queue|token|crowded|slow|line|counter time)\b/i,
    negativeSolution:
      '1. Review OPD peak-hour scheduling and implement digital token display in the waiting lobby.\n2. Enable pre-consultation vital checks during wait times to minimize idle time.\n3. Patient relations team to communicate expected consultation delays exceeding 20 minutes.',
    neutralSolution:
      '1. Optimize appointment slots to avoid batch patient arrivals.\n2. Provide informative waiting lounge displays or Wi-Fi to improve patient waiting comfort.',
  },
  {
    topic: 'Billing & Administration',
    pattern: /\b(bill|billing|charge|charged|expensive|money|cost|price|insurance|claim|reception|counter|refund|receipt|admin|cashless|overcharg|loot)\b/i,
    negativeSolution:
      '1. Patient relations coordinator to call patient within 24 hours to explain itemized billing and resolve discrepancies.\n2. Conduct retraining for reception and billing counter staff on empathetic financial counseling.\n3. Expedite TPA insurance / cashless desk pre-authorization turnaround time.',
    neutralSolution:
      '1. Ensure transparent, printed cost breakdown estimates are provided before procedures.\n2. Offer multiple digital payment counters to avoid billing checkout queues.',
  },
  {
    topic: 'Doctor & Clinical Consultation',
    pattern: /\b(doctor|dr|physician|surgeon|treatment|diagnosis|surgery|consultation|prescription|medicine|specialist|gynecologist|cardiologist|examination|attitude)\b/i,
    negativeSolution:
      '1. Medical Director to review consultation notes and discuss communication feedback with consulting clinician.\n2. Schedule a senior medical officer follow-up call to assess patient health recovery and address clinical concerns.\n3. Reinforce clinical bedside empathy and patient-involvement protocols during departmental clinical audits.',
    neutralSolution:
      '1. Ensure doctors provide detailed post-consultation discharge summaries with clear dosage instructions.\n2. Provide written patient educational brochures for diagnosed health conditions.',
  },
  {
    topic: 'Nursing & Emergency Hospitality',
    pattern: /\b(nurse|nursing|sister|staff|hospitality|emergency|casualty|icu|security|housekeeping|rude|attitude|behavior|polite|unfriendly)\b/i,
    negativeSolution:
      '1. Nursing Superintendent to conduct an immediate briefing on empathetic patient care and compassionate communication.\n2. Review nursing round frequency in ward / casualty to ensure prompt bell call responses.\n3. Patient relations officer to log internal feedback and counsel front-line attendants.',
    neutralSolution:
      '1. Ensure floor nurses introduce themselves at each shift handover.\n2. Conduct regular customer service refresher workshops for auxiliary hospital staff.',
  },
  {
    topic: 'Hospital Cleanliness & Facilities',
    pattern: /\b(clean|hygiene|dirty|room|ot|ward|bed|washroom|toilet|facility|infrastructure|ambience|parking|ventilator|ac|water)\b/i,
    negativeSolution:
      '1. Housekeeping manager to initiate immediate sanitation inspection and deep-cleaning audit of the reported area.\n2. Enforce strict hourly washroom and room cleaning checklist sign-offs.\n3. Facility engineer to inspect AC / plumbing / elevator maintenance logs.',
    neutralSolution:
      '1. Schedule routine preventive maintenance on room amenities and waiting area air conditioning.\n2. Increase frequency of sanitization rounds during peak outpatient hours.',
  },
];

/**
 * Step-by-Step NLP Tokenizer and Sentiment Classifier
 */
export function analyzeSentimentLocally(
  rawText: string,
  _ratingFallback?: number
): SentimentAnalysisResult {
  if (!rawText || !rawText.trim()) {
    return {
      sentiment: 'neutral',
      score: 0.5,
      topic: 'General Hospital Experience',
      solution: undefined,
      probabilities: { positive: 0.33, neutral: 0.34, negative: 0.33 },
    };
  }

  // ── Step 1: Preprocess text ──
  const cleanStr = rawText
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // ── Step 2: Tokenize ──
  const tokens = cleanStr.split(' ').filter((t) => t.length > 0);

  // ── Step 3: Analyze each word with n-gram intensifiers and negations ──
  let totalPositiveScore = 0;
  let totalNegativeScore = 0;
  let neutralCount = 0;

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];

    // Check for previous intensifier (e.g. "very pleased", "really liked")
    let multiplier = 1.0;
    if (i > 0 && INTENSIFIERS[tokens[i - 1]]) {
      multiplier = INTENSIFIERS[tokens[i - 1]];
    }

    // Check for preceding negation within 2 words (e.g. "not good", "never helpful", "not bad")
    let isNegated = false;
    if (i > 0 && NEGATIONS.has(tokens[i - 1])) isNegated = true;
    if (i > 1 && NEGATIONS.has(tokens[i - 2])) isNegated = true;

    // Direct multi-word phrases check
    if (POSITIVE_WORDS[word]) {
      const val = POSITIVE_WORDS[word] * multiplier;
      if (isNegated) {
        totalNegativeScore += Math.abs(val) * 0.85;
      } else {
        totalPositiveScore += val;
      }
    } else if (NEGATIVE_WORDS[word]) {
      const val = Math.abs(NEGATIVE_WORDS[word]) * multiplier;
      if (isNegated) {
        // "not bad", "no pain" -> positive/neutral shift
        totalPositiveScore += val * 0.7;
      } else {
        totalNegativeScore += val;
      }
    } else {
      neutralCount++;
    }
  }

  // Common healthcare phrase boosters
  const textLower = rawText.toLowerCase();
  if (/\b(really liked|really enjoyed|very pleased|pleased with|good service|loved your service|enjoyed your service|liked your service|great job|thank you|thanks for|best hospital)\b/i.test(textLower)) {
    totalPositiveScore += 3.5;
  }
  if (/\b(money minded|waste of money|loot|worst experience|pathetic service|rude staff|bad experience|never visit again)\b/i.test(textLower)) {
    totalNegativeScore += 4.0;
  }

  // ── Step 4: Calculate Probabilities and Final Sentiment ──
  const sumScores = totalPositiveScore + totalNegativeScore + 1.2;
  const rawPosProb = (totalPositiveScore + 0.1) / sumScores;
  const rawNegProb = (totalNegativeScore + 0.1) / sumScores;
  const rawNeuProb = 1.0 - (rawPosProb + rawNegProb);

  const posProb = Math.max(0.01, Math.min(0.99, Number(rawPosProb.toFixed(3))));
  const negProb = Math.max(0.01, Math.min(0.99, Number(rawNegProb.toFixed(3))));
  const neuProb = Math.max(0.01, Math.min(0.99, Number((1.0 - (posProb + negProb)).toFixed(3))));

  let finalSentiment: SentimentType = 'neutral';
  let finalScore = 0.5;

  if (totalPositiveScore > totalNegativeScore && totalPositiveScore >= 1.2) {
    finalSentiment = 'positive';
    finalScore = Math.min(0.99, 0.75 + totalPositiveScore * 0.05);
  } else if (totalNegativeScore > totalPositiveScore && totalNegativeScore >= 1.2) {
    finalSentiment = 'negative';
    finalScore = Math.min(0.99, 0.75 + totalNegativeScore * 0.05);
  } else {
    // If text expresses mild or mixed opinion
    if (totalPositiveScore > totalNegativeScore + 0.5) {
      finalSentiment = 'positive';
      finalScore = 0.72;
    } else if (totalNegativeScore > totalPositiveScore + 0.5) {
      finalSentiment = 'negative';
      finalScore = 0.72;
    } else {
      finalSentiment = 'neutral';
      finalScore = 0.65;
    }
  }

  // ── Step 5: Aspect / Topic Extraction ──
  let matchedTopic = 'General Hospital Experience';
  let negativeAction =
    '1. Patient Relations Lead to contact the patient to acknowledge feedback and offer resolution.\n2. Department head to review service workflow and log for quality improvement.';
  let neutralAction =
    '1. Review patient interaction notes during weekly staff huddle.\n2. Follow up with patient on their recovery status.';

  for (const rule of TOPIC_RULES) {
    if (rule.pattern.test(textLower)) {
      matchedTopic = rule.topic;
      negativeAction = rule.negativeSolution;
      neutralAction = rule.neutralSolution;
      break;
    }
  }

  // ── Step 6: Tailored Corrective Solution for Negative / Neutral ──
  let solution: string | undefined = undefined;
  if (finalSentiment === 'negative') {
    solution = negativeAction;
  } else if (finalSentiment === 'neutral') {
    solution = neutralAction;
  } else {
    solution = undefined; // No corrective action needed for positive reviews
  }

  return {
    sentiment: finalSentiment,
    score: Number(finalScore.toFixed(3)),
    topic: matchedTopic,
    solution,
    patientResponseMessage: PATIENT_RESPONSE_MESSAGES[finalSentiment],
    probabilities: {
      positive: posProb,
      neutral: neuProb,
      negative: negProb,
    },
  };
}

/**
 * Async analysis with optional Groq AI generation for high-depth personalized corrective solutions
 */
export async function analyzeFeedbackWithAI(
  text: string,
  rating: number
): Promise<SentimentAnalysisResult> {
  const localResult = analyzeSentimentLocally(text, rating);

  if (localResult.sentiment === 'positive' || !text.trim() || !GROQ_API_KEY) {
    return localResult;
  }

  try {
    const prompt = `You are a Chief Hospital Quality & Medical Director.
A patient submitted the following ${localResult.sentiment} hospital feedback:
Feedback: "${text}"
Category: ${localResult.topic}

Provide a concise, numbered 3-point operational corrective action plan for the hospital management and nursing/admin team to address this specific feedback. Keep each point brief, actionable, and clinically professional.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 220,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const aiPlan = data?.choices?.[0]?.message?.content?.trim();
      if (aiPlan) {
        return {
          ...localResult,
          solution: aiPlan,
        };
      }
    }
  } catch (err) {
    console.warn('Groq AI solution generation notice, using local plan:', err);
  }

  return localResult;
}
