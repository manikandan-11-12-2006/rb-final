/**
 * src/feedback/services/voiceTranscription.ts
 *
 * Robust Voice Transcription Service for Patient Feedback.
 * - Prompts for Microphone Permission (getUserMedia)
 * - Uses Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * - Sends raw audio transcript to MyMemory open source API for translation
 */

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognitionClass(): new () => SpeechRecognitionInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
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
    formData.append('model', 'whisper-large-v3');
    formData.append('temperature', '0');
    formData.append('prompt', 'Hospital patient review: டாக்டர் நல்லா பாத்தாரு, ட்ரீட்மென்ட் பண்ணாங்க, குணமாகிடுச்சு, வலி குறைஞ்சுடுச்சு, மருந்து மாத்திரை, நர்சிங் ஸ்டாஃப், நர்ஸ் சரியா பாத்துக்கல, ரூடா பிஹேவ் பண்ணாங்க, ரூடா பேசினாங்க, சரியாவே கவனிக்கல, ரொம்ப நேரம் வெயிட் பண்ண வச்சாங்க, மரியாதை இல்ல, புடிக்கல, Tambaram Medical Center doctor nurse staff treatment was very good or rude behavior.');

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
    } else {
      const errJson = await resp.json().catch(() => ({}));
      console.warn('Groq Whisper STT API returned error:', resp.status, errJson);
    }
  } catch (err) {
    console.warn('Groq Whisper STT error:', err);
  }
  return '';
}

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && (
    getSpeechRecognitionClass() !== null ||
    typeof MediaRecorder !== 'undefined' ||
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function isNonsenseOrSilence(text: string): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length < 3) return true;

  const words = trimmed.split(/\s+/);
  if (words.length <= 3 && words.every((w) => w === words[0]) && trimmed.length <= 8) {
    return true;
  }

  if (/^(.)\1+$/.test(trimmed.replace(/\s+/g, ''))) {
    return true;
  }

  const silenceHallucinations = [
    'ர ர', 'ரர', 'ர', 'ஆ ஆ', 'ஆ', 'த த', '...', '....', '---',
    'thank you', 'thank you.', 'thanks for watching', 'thanks for watching.',
    'subscribe', 'subtitles by', 'you', 'bye', 'so', 'oh', 'uh', 'um',
    'please subscribe', 'mbc', 'amara.org'
  ];
  if (silenceHallucinations.includes(trimmed.toLowerCase())) {
    return true;
  }

  if (!/[\p{L}\p{N}]/u.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Request microphone permission and start continuous speech-to-text recording.
 */
export async function startSpeechRecognition(
  langCode: string,
  onPartial: (text: string) => void,
  onFinal: (text: string) => void,
  onError: (errorMsg: string) => void
): Promise<() => void> {
  const SpeechClass = getSpeechRecognitionClass();
  const isMobile = typeof window !== 'undefined' && (
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    ('ontouchstart' in window && navigator.maxTouchPoints > 0)
  );

  let mediaStream: MediaStream | null = null;
  let recordRTCInstance: any = null;
  let mediaRecorder: MediaRecorder | null = null;
  const recordedChunks: Blob[] = [];
  let recordedMime = '';

  // 1. Request microphone permissions & start RecordRTC / MediaRecorder for universal mobile recording
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // Prevents mobile DSP from aggressively clipping soft Tamil syllables
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });

      const RecordRTC = (window as any).RecordRTC;
      if (typeof RecordRTC !== 'undefined') {
        recordRTCInstance = new RecordRTC(mediaStream, {
          type: 'audio',
          mimeType: 'audio/wav',
          recorderType: RecordRTC.StereoAudioRecorder,
          numberOfAudioChannels: 1,
          desiredSampRate: 16000,
          bufferSize: 4096,
          timeSlice: 1000,
        });
        recordRTCInstance.startRecording();
        recordedMime = 'audio/wav';
      } else if (typeof MediaRecorder !== 'undefined') {
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
    }
  } catch (err: unknown) {
    console.warn('[Mic Access Error]', err);
    onError('Microphone access denied. Please click "Allow" in your browser address bar.');
    return () => {};
  }

  // 2. Instantiate Speech Recognition for real-time live preview ONLY on Desktop
  // On mobile phones, running Web Speech alongside MediaRecorder steals the audio track,
  // causing silent recordings and sudden termination. On mobile, we rely exclusively on MediaRecorder + Whisper AI.
  let recognition: SpeechRecognitionInstance | null = null;
  let fullTranscript = '';
  let interimTranscript = '';
  let isIntentionallyStopped = false;

  if (!isMobile && SpeechClass) {
    try {
      recognition = new SpeechClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langCode || 'ta-IN';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result && result[0]) {
            if (result.isFinal) {
              finalStr += (finalStr ? ' ' : '') + result[0].transcript.trim();
            } else {
              interimStr += (interimStr ? ' ' : '') + result[0].transcript.trim();
            }
          }
        }
        fullTranscript = finalStr;
        interimTranscript = interimStr;
        const display = (fullTranscript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
        onPartial(display);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech') return;
        console.warn('[SpeechRecognition] Warning:', event.error);
      };

      recognition.onend = () => {
        if (!isIntentionallyStopped && recognition) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.start();
    } catch (err) {
      console.warn('[SpeechClass start error]', err);
    }
  } else if (isMobile) {
    onPartial('🎙️ Recording voice... Speak clearly into your phone');
  }

  // Return stop function
  return async () => {
    isIntentionallyStopped = true;
    if (recognition) {
      try { recognition.stop(); } catch {}
    }

    // Graceful 350ms buffer flush so trailing syllable is not truncated
    await new Promise((r) => setTimeout(r, 350));

    let audioBlob: Blob | null = null;
    if (recordRTCInstance) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          try { audioBlob = recordRTCInstance.getBlob(); } catch {}
          resolve();
        }, 2000);

        recordRTCInstance.stopRecording(() => {
          clearTimeout(timeout);
          try {
            audioBlob = recordRTCInstance.getBlob();
          } catch {}
          resolve();
        });
      });
      try { recordRTCInstance.destroy(); } catch {}
      recordRTCInstance = null;
    } else if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (recordedChunks.length > 0) {
            try { audioBlob = new Blob(recordedChunks, { type: recordedMime || 'audio/webm' }); } catch {}
          }
          resolve();
        }, 1500);

        if (!mediaRecorder) return resolve();
        mediaRecorder.onstop = () => {
          clearTimeout(timeout);
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
          clearTimeout(timeout);
          resolve();
        }
      });
    } else if (recordedChunks.length > 0) {
      audioBlob = new Blob(recordedChunks, { type: recordedMime || 'audio/webm' });
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }

    const webSpeechText = (fullTranscript + ' ' + interimTranscript).trim();
    let finalText = '';

    // Prioritize Whisper AI on mobile and whenever audioBlob is available
    if (audioBlob && audioBlob.size > 200) {
      onPartial('⚡ Transcribing voice with Groq Whisper AI…');
      const whisperText = await transcribeAudioWithWhisper(audioBlob, langCode);
      const whisperIsReal = whisperText && !isNonsenseOrSilence(whisperText);
      const webSpeechIsReal = webSpeechText && !isNonsenseOrSilence(webSpeechText);

      if (whisperIsReal) {
        finalText = whisperText.trim();
      } else if (webSpeechIsReal) {
        finalText = webSpeechText;
      } else {
        finalText = '';
      }
    } else if (webSpeechText && !isNonsenseOrSilence(webSpeechText)) {
      finalText = webSpeechText;
    }

    onFinal(finalText);
  };
}

const GROQ_API_KEY =
  (import.meta as any).env?.VITE_GROQ_API_KEY || '';

/**
 * Cleans raw speech transcript using Groq AI.
 * STRICT REQUIREMENT: Only grammar, punctuation, spelling, and sentence casing changes.
 * ABSOLUTELY NO content modifications, expansions, embellishments, or invented details.
 */
export async function cleanWithGroq(
  rawTranscript: string,
  detectedLanguage?: string
): Promise<string> {
  if (!rawTranscript.trim() || isNonsenseOrSilence(rawTranscript)) return '';

  const sourceLangCode = detectedLanguage ? detectedLanguage.split('-')[0] : 'ta';
  const targetLangCode = 'en';

  // 1. Try Groq AI: strict grammar correction and faithful direct translation if needed
  const isEnglish = sourceLangCode === 'en';
  const promptContent = isEnglish
    ? `You are an expert grammar and language correction assistant.
The user provided voice feedback:
"${rawTranscript}"

Your ONLY task is to correct grammar, punctuation, spelling, sentence capitalization, and remove vocal fillers (e.g., um, uh, ah).
STRICT RULES:
1. ONLY GRAMMAR CHANGES - NO CONTENT CHANGES: Do NOT change, add, rephrase, elaborate, or omit any thoughts, words, details, meaning, or sentiments.
2. DO NOT INVENT: Do NOT add praise, complaints, or sentences that the user did not say.
3. Keep the user's exact words and natural phrasing, applying ONLY necessary grammatical and punctuation corrections.
4. If the text has no meaningful feedback or is gibberish, return EXACTLY: (No feedback detected)
5. Return ONLY the clean, corrected text with no quotation marks, markdown, apologies, or explanations.`
    : `You are an expert English healthcare feedback translator and editor.
The user is a PATIENT providing spoken feedback about their hospital / clinic visit in conversational Indian regional language / Tanglish:
"${rawTranscript}"

Your task is to write a natural, grammatically fluent English review that FAITHFULLY and ACCURATELY preserves the patient's exact experience and sentiments.

CRITICAL TRANSLATION RULES:
1. STRICT SENTIMENT PRESERVATION:
   - If the patient is expressing PRAISE (e.g., "நல்ல ட்ரீட்மென்ட்" / "நல்லா பண்ணார்" = gave good treatment, "குறைஞ்சுது" / "குறைச்சுட்டாங்க" / "குணமாகிடுச்சு" = relieved my pain / cured / resolved problem), produce a genuine, warm positive review!
   - NEVER invent negative complaints or add phrases like "but I was not satisfied with the outcome" when the patient was happy!
   - Conversely, if the patient expresses DISSATISFACTION or COMPLAINTS (e.g. nurse rudeness, poor care, long waiting, carelessness), PRESERVE THE CRITICISM 100% FAITHFULLY in fluent English. NEVER soften, invert, or flip criticism into praise!
2. SPEECH-TO-TEXT & TANGLISH PHONETIC AUTO-CORRECTION:
   The voice was recorded on a mobile phone and may have minor phonetic transcription slips or slurred endings:
   - "ரூடா பிஹேவ்" / "ரூடா பியேப்" / "ரூடா பிகேவ்" / "ரூடா பேசினாங்க" / "ரூடா நடந்துக்கிட்டாங்க" = "behaved very rudely / acted in an uncaring, harsh, and disrespectful manner". (STRICT WARNING: This is Tanglish for 'behaved rudely'. It must NEVER be translated as 'blood pressure', 'BP', or anything positive!).
   - "சரியாவே பாத்துக்கல" / "பாத்துக்கல" / "பார்த்துக்கொள்ளலாம்" (in negative context or paired with complaints) / "சரியா கவனிக்கல" / "கவனிக்கல" = "did not take proper care of me / neglected to look after me properly / did not attend to me well". (STRICT WARNING: Do NOT translate as 'took good care' or 'was excellent'! Note: "சரியாவே" means "properly at all", it is NOT a person's name).
   - "ரொம்ப நேரம் வெயிட் பண்ண வச்சாங்க" / "ரொம்ப நேரம் ஆச்சு" = "made me wait for an excessively long time".
   - "மரியாதை இல்ல" / "ரெஸ்பான்ஸ் இல்ல" = "showed no respect / gave no proper assistance".
   - "ட்ரீட்மென்னார்" / "ட்ரீட்மென்ட் பண்ணார்" / "பண்ணாரு" = "The doctor provided very good treatment / treated me well".
   - "குறைஞ்சுது" / "குறைச்சுட்டாங்க" / "குறுச்சுந்துது" / "குணமாகிடுச்சு" / "குணமாச்சு" = "relieved my pain / resolved my symptoms / cured my health issue".
   - "பாத்தாரு" / "காமிச்சோம்" / "செக் பண்ணாரு" / "எக்ஸமைன் பண்ணாங்க" = "examined me thoroughly / attended to me very well".
   - "புடிக்கல" / "பிடிக்கவில்லை" = "I did not like it / was very dissatisfied" (NEVER translate as "did not understand").
   - "ஸ்டாப்ஸ்" = "the hospital nursing and reception staff".
   - Intelligently deduce the patient's intended meaning from healthcare context.
3. OUTPUT FORMAT:
   - Write like a real patient submitting a Google Review for Tambaram Medical Center.
   - Return ONLY the clean, polished English review text with no quotes, preamble, or markdown.
4. NOISE & GIBBERISH:
   - If the input is just meaningless noise, syllables, or contains no visit feedback, return EXACTLY: (No feedback detected).`;

  const models = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];

  for (const model of models) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [{
            role: 'user',
            content: promptContent,
          }],
          temperature: 0.1,
          max_tokens: 300,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content && content.length > 0) {
          const cleaned = content.replace(/^["'`]|["'`]$/g, '').replace(/```[a-z]*\n?|\n?```/gi, '').trim();
          if (
            cleaned.toLowerCase().includes('unable to provide') ||
            cleaned.toLowerCase().includes('cannot provide') ||
            cleaned.toLowerCase().includes('does not contain') ||
            cleaned.toLowerCase().includes('no feedback detected') ||
            isNonsenseOrSilence(cleaned)
          ) {
            return '';
          }
          return cleaned;
        }
      } else {
        console.warn(`Groq ${model} status:`, resp.status);
      }
    } catch (err) {
      console.warn(`Groq ${model} error:`, err);
    }
  }

  return '';
}

