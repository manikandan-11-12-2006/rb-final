/**
 * voiceTranscriptionService.ts
 *
 * Pipeline:
 *  1. Browser Web Speech API (SpeechRecognition) — 100% FREE, no API key needed
 *     Built into Chrome & Edge. Supports all major Indian regional languages.
 *  2. Raw transcript → Groq LLM for cleaning, grammar fix & translation to English
 *
 * Only VITE_GROQ_API_KEY is needed (for text cleaning step).
 * No Google Cloud account or billing required for transcription.
 */

const GROQ_API_KEY =
  import.meta.env.VITE_GROQ_API_KEY || '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranscriptionResult {
  rawTranscript: string;
  cleanedText: string;
  detectedLanguage: string;
  sttSuccess: boolean;
  geminiSuccess: boolean;
}

export interface SpeechRecognitionOptions {
  /** BCP-47 language code e.g. 'ta-IN', 'hi-IN' */
  lang: string;
  /** Max seconds to wait for speech before auto-stopping (default 30) */
  maxSeconds?: number;
  /** Called each time an interim result arrives (for live UI updates) */
  onInterim?: (text: string) => void;
}

// ─── Browser Compatibility Check ─────────────────────────────────────────────

export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    (
      'SpeechRecognition' in window ||
      'webkitSpeechRecognition' in window ||
      Boolean(navigator.mediaDevices?.getUserMedia) ||
      typeof MediaRecorder !== 'undefined'
    )
  );
}

/**
 * Transcribe audio blob using Groq Whisper AI (Guaranteed 100% on Mobile / iOS / Android)
 */
export async function transcribeAudioWithWhisper(
  audioBlob: Blob,
  langCode?: string
): Promise<string> {
  try {
    if (!audioBlob || audioBlob.size < 200) return '';
    const formData = new FormData();
    let ext = 'webm';
    const mime = (audioBlob.type || '').toLowerCase();
    if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) {
      ext = 'm4a';
    } else if (mime.includes('ogg')) {
      ext = 'ogg';
    } else if (mime.includes('wav')) {
      ext = 'wav';
    } else {
      ext = 'webm';
    }

    formData.append('file', audioBlob, `speech.${ext}`);
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('temperature', '0');

    if (langCode) {
      const shortLang = langCode.split('-')[0].toLowerCase();
      if (['ta', 'hi', 'en', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'ur'].includes(shortLang)) {
        formData.append('language', shortLang);
      }
    }

    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    });

    if (resp.ok) {
      const data = await resp.json();
      return (data.text || '').trim();
    }
  } catch (err) {
    console.warn('Groq Whisper STT error:', err);
  }
  return '';
}

// ─── Step 1: Dual-Engine Speech Recognition (Mobile & Desktop) ────────────────

export function startSpeechRecognition(
  options: SpeechRecognitionOptions
): {
  stop: () => void;
  promise: Promise<{ transcript: string; success: boolean }>;
} {
  const isMobile = typeof window !== 'undefined' && (
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ('ontouchstart' in window && navigator.maxTouchPoints > 0)
  );

  const SpeechRecognitionAPI =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  const recordedChunks: Blob[] = [];
  let recordedMime = '';

  let recognition: any = null;
  let finalTranscript = '';
  let interimTranscript = '';
  let resolvePromise: (val: { transcript: string; success: boolean }) => void;
  let rejectPromise: (err: any) => void;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<{ transcript: string; success: boolean }>(
    (resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise  = reject;
    }
  );

  // Initialize MediaRecorder for universal recording
  if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }).then((stream) => {
      mediaStream = stream;
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) recordedMime = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) recordedMime = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/aac')) recordedMime = 'audio/aac';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) recordedMime = 'audio/ogg';
        else if (MediaRecorder.isTypeSupported('audio/webm')) recordedMime = 'audio/webm';

        mediaRecorder = recordedMime
          ? new MediaRecorder(mediaStream, { mimeType: recordedMime })
          : new MediaRecorder(mediaStream);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.start(250);
      }
    }).catch((err) => {
      console.warn('Microphone stream error:', err);
    });
  }

  // Only start Web Speech API on Desktop
  if (!isMobile && SpeechRecognitionAPI) {
    try {
      recognition = new SpeechRecognitionAPI();
      recognition.lang            = options.lang;
      recognition.continuous      = true;
      recognition.interimResults  = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item && item[0]) {
            if (item.isFinal) {
              finalStr += (finalStr ? ' ' : '') + item[0].transcript.trim();
            } else {
              interimStr += (interimStr ? ' ' : '') + item[0].transcript.trim();
            }
          }
        }
        finalTranscript = finalStr;
        interimTranscript = interimStr;
        if (options.onInterim) {
          options.onInterim((finalTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') return;
        console.warn('[WebSpeech API] Notice:', event.error);
      };

      recognition.start();
    } catch (e) {
      console.warn('Web Speech API error:', e);
    }
  } else if (isMobile && options.onInterim) {
    options.onInterim('🎙️ Recording voice... Speak clearly into your phone');
  }

  // Auto-stop after maxSeconds (default 60s)
  const maxMs = (options.maxSeconds ?? 60) * 1000;
  timeoutId = setTimeout(() => {
    stop();
  }, maxMs);

  const stop = async () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (recognition) {
      try { recognition.stop(); } catch {}
    }

    let audioBlob: Blob | null = null;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        const to = setTimeout(() => {
          if (recordedChunks.length > 0) {
            try { audioBlob = new Blob(recordedChunks, { type: recordedMime || 'audio/webm' }); } catch {}
          }
          resolve();
        }, 1500);

        if (!mediaRecorder) return resolve();
        mediaRecorder.onstop = () => {
          clearTimeout(to);
          try {
            audioBlob = new Blob(recordedChunks, { type: recordedMime || 'audio/webm' });
          } catch {}
          resolve();
        };

        try {
          if (typeof mediaRecorder.requestData === 'function') {
            mediaRecorder.requestData();
          }
          mediaRecorder.stop();
        } catch {
          clearTimeout(to);
          resolve();
        }
      });
    } else if (recordedChunks.length > 0) {
      audioBlob = new Blob(recordedChunks, { type: recordedMime || 'audio/webm' });
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }

    let resultText = (finalTranscript + ' ' + interimTranscript).trim();

    // Prioritize Groq Whisper AI on mobile and whenever audioBlob is available
    if (audioBlob && audioBlob.size > 200) {
      if (options.onInterim) {
        options.onInterim('⚡ Transcribing voice with Groq Whisper AI…');
      }
      const whisperText = await transcribeAudioWithWhisper(audioBlob, options.lang);
      if (whisperText && whisperText.trim()) {
        resultText = whisperText.trim();
      }
    }

    resolvePromise({
      transcript: resultText,
      success: Boolean(resultText),
    });
  };

  return { stop, promise };
}

/// ─── Step 2: Groq Text Cleaning ───────────────────────────────────────────────

/**
 * Sends raw Web Speech transcript to Groq (llama-3.3-70b-versatile) to:
 *  - Translate to English (always, regardless of input language)
 *  - Fix grammar, remove filler words
 *  - Preserve original sentiment
 *
 * Groq docs: https://console.groq.com/docs/openai
 */
export async function cleanWithGemini(
  rawTranscript: string,
  detectedLanguage: string
): Promise<{ cleanedText: string; success: boolean }> {
  if (!GROQ_API_KEY) {
    console.warn('[Groq] VITE_GROQ_API_KEY not set — returning raw transcript.');
    return { cleanedText: rawTranscript, success: false };
  }

  if (!rawTranscript.trim()) {
    return { cleanedText: '', success: false };
  }

  const langName =
    detectedLanguage === 'ta-IN' ? 'Tamil' :
    detectedLanguage === 'hi-IN' ? 'Hindi' :
    detectedLanguage === 'te-IN' ? 'Telugu' :
    detectedLanguage === 'kn-IN' ? 'Kannada' :
    detectedLanguage === 'ml-IN' ? 'Malayalam' :
    detectedLanguage === 'mr-IN' ? 'Marathi' :
    detectedLanguage === 'bn-IN' ? 'Bengali' :
    detectedLanguage === 'gu-IN' ? 'Gujarati' :
    detectedLanguage === 'pa-IN' ? 'Punjabi' :
    'Indian regional language';

  const isEnglish = (detectedLanguage || '').startsWith('en');
  const promptContent = isEnglish
    ? `You are an expert grammar and language correction assistant.
The user provided voice feedback:
"${rawTranscript}"

Your ONLY task is to correct grammar, punctuation, spelling, sentence capitalization, and remove vocal fillers (e.g., um, uh, ah).
STRICT RULES:
1. ONLY GRAMMAR CHANGES - NO CONTENT CHANGES: Do NOT change, add, rephrase, elaborate, or omit any thoughts, words, details, meaning, or sentiments.
2. DO NOT INVENT: Do NOT add praise, complaints, or sentences that the user did not say.
3. Keep the user's exact words and natural phrasing, applying ONLY necessary grammatical and punctuation corrections.
4. Return ONLY the clean, corrected text with no quotation marks, markdown, or explanations.`
    : `You are an expert English healthcare feedback editor and translation specialist.
The user is a PATIENT providing voice feedback about their hospital visit in spoken conversational ${langName} / Tanglish:
"${rawTranscript}"

Your task is to write a grammatically flawless, natural, and completely accurate English review that FAITHFULLY preserves the patient's exact experience, criticisms, and sentiments without altering or distorting the meaning.

CORE TRANSLATION & ACCURACY RULES:
1. SPEAKER IS ALWAYS A PATIENT (NEVER A WORKER):
   - "அங்க ஒர்க் பண்ண ஸ்டாப்ஸ்" / "ஒர்க் பண்ற ஸ்டாப்ஸ்" means "the staff working there" (the hospital staff on duty).
   - NEVER translate "ஒர்க் பண்ண ஸ்டாப்ஸ்" as "I visited for work" or "work-related issue"! The user is a patient reviewing hospital staff.
2. PRESERVE CRITICISMS & DISSATISFACTION HONESTLY (DO NOT SANITIZE OR SOFTEN):
   - "எனக்கு புடிக்கல" / "பிடிக்கவில்லை" = "I did not like" / "I was very dissatisfied with". NEVER soften to corporate euphemisms like "I was unable to connect with".
   - "பேஷண்ட்டாக நான் சொன்னதை எதுவும் ஹேர் பண்ணல / கேக்கல" = "did not patiently listen to anything I said" / "was not patient and did not listen to what I said".
   - "சிஸ்கும் / சிக்னஸ்" = "my sickness / condition / symptoms".
   - "டிஃப்ரெண்ட்ஸ் இருக்குன்னு தோணுது" = "feel there is a big difference / mismatch".
3. ACCURATE TRANSLATION OF "கேட்டார்" (kēṭṭār):
   - In Tamil patient feedback, "கேட்டார்" (from கேள்) means "LISTENED TO ME / ATTENDED TO ME" (e.g. "டாக்டர் ரொம்ப பேஷண்ட்டாக கேட்டார்" means "The doctor listened to me very patiently").
   - NEVER translate "கேட்டார்" as "asked questions" unless "கேள்வி" (questions) was explicitly spoken.
4. PROFESSIONAL HEALTHCARE VOCABULARY & MEDICAL PHONETICS:
   - "டிஸ்ஸஸ்" / "டிஸீஸ்" = "health condition" / "illness" / "disease" (NEVER translate as "disc" or "disc issue").
   - "எக்ஸமைன் பண்ண" = "examined me".
   - "மெடிசின்" = "medication / medicine prescribed".
   - "ட்ரீட்மெண்ட்" = "appropriate treatment".
   - Use "consulted the doctor" or "visited the hospital today, where the doctor..." instead of colloquial "saw the doctor".
5. COMPOUND PREDICATES & NATURAL GRAMMATICAL FLOW:
   - Use natural sentence structures with proper coordination and parallel verbs.
   - Avoid repetitive staccato sentences starting with "He was... He then... He also...".
6. REMOVE SPOKEN FILLERS & STUTTERS:
   - Clean up speech recognition stutters and conversational fillers (e.g., "அண்ட் என்ன? என்ன", "ஐ திங்க் லைக் என்னோட", "வந்து", "அங்க வந்து").
7. OUTPUT FORMAT:
   - Return ONLY the clean, grammatically correct English review text with no quotes, preamble, or markdown.`;

  const models = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

  for (const model of models) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.1,
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: promptContent,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const cleanedText: string =
          data?.choices?.[0]?.message?.content?.trim() || '';
        if (cleanedText && cleanedText.length > 0) {
          console.info('[Groq] Cleaned with ' + model + ':', cleanedText);
          return {
            cleanedText: cleanedText.replace(/^["'`]|["'`]$/g, '').replace(/```[a-z]*\n?|\n?```/gi, '').trim(),
            success: true,
          };
        }
      } else {
        console.warn(`[Groq] ${model} response not ok:`, response.status);
      }
    } catch (err) {
      console.warn(`[Groq] ${model} network notice:`, err);
    }
  }

  return { cleanedText: rawTranscript, success: false };
}

// ─── Combined export for backward compatibility ───────────────────────────────

export async function transcribeAndClean(
  _audioBlob: Blob
): Promise<TranscriptionResult> {
  return {
    rawTranscript: '',
    cleanedText: '',
    detectedLanguage: 'unknown',
    sttSuccess: false,
    geminiSuccess: false,
  };
}
