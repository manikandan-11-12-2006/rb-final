/* ==========================================================================
   Standalone Feedback Interface — app.js
   Tambaram Medical Center
   ========================================================================== */

'use strict';

const GROQ_API_KEY  = window.__GROQ_API_KEY__ || localStorage.getItem('GROQ_API_KEY') || '';
const FIREBASE_URL  = 'https://rescuebridge-fe59b-default-rtdb.firebaseio.com/review_requests.json';
const GOOGLE_REVIEW = 'https://www.google.com/search?q=Tambaram%20Medical%20Center%20Google%20reviews#sv=CAESzQEKuQEStgEKd0FKaVQ0dExfWHgwY3JMVU1XbVVJcmsxMjdKS2tVRFBEZGxnQ0lqdkxVMlZ2YkpudkNtd2tIcUZJLWZ4ZFNPWTdySEpHQXN2QTBxUEZvZjYzOW9mdllpT1lxdWIyYmdKaUlDeTBBZmcwNklzQTJ4LWtiR2xmdktJEhczWXZBYXJMTEg1dU5zZU1Qb3BiYWlRVRoiQURzcjlmUzRSNzhzZzNpMzJNWGRDUy00SGoxSlZ3bUFBQRIEODA1MRoBMyoAMAA4AUAAGAAg8NSOHEoCEAE';

(function () {

  /* ── DOM refs ── */
  const elHospitalName      = document.getElementById('hospitalName');
  const elPatientNameInput  = document.getElementById('patientNameInput');
  const elPatientPhoneInput = document.getElementById('patientPhoneInput');

  const ratingScreen        = document.getElementById('ratingScreen');
  const highRatingScreen    = document.getElementById('highRatingSuccessScreen');
  const lowRatingScreen     = document.getElementById('lowRatingSuccessScreen');

  const starBtns            = document.querySelectorAll('.star-btn');
  const ratingBadge         = document.getElementById('ratingBadge');
  const feedbackInputArea   = document.getElementById('feedbackInputArea');

  const btnVoiceMode        = document.getElementById('btnVoiceMode');
  const btnTextMode         = document.getElementById('btnTextMode');
  const voiceSection        = document.getElementById('voiceSection');
  const textSection         = document.getElementById('textSection');
  const switchTextLink      = document.getElementById('switchTextLink');
  const switchVoiceLink     = document.getElementById('switchVoiceLink');

  /* Voice UI */
  const btnStartRecord      = document.getElementById('btnStartRecord');
  const btnStopRecord       = document.getElementById('btnStopRecord');
  const micIdleState        = document.getElementById('micIdleState');
  const micRecordingState   = document.getElementById('micRecordingState');
  const micCleaningState    = document.getElementById('micCleaningState');
  const liveTextPreview     = document.getElementById('liveTextPreview');
  const recordingTimer      = document.getElementById('recordingTimer');
  const rawTranscriptBox    = document.getElementById('rawTranscriptBox');
  const rawTranscriptText   = document.getElementById('rawTranscriptText');
  const cleanedReviewBox    = document.getElementById('cleanedReviewBox');
  const cleanedReviewText   = document.getElementById('cleanedReviewText');
  const btnCopyCleaned      = document.getElementById('btnCopyCleaned');
  const btnSubmitVoice      = document.getElementById('btnSubmitVoice');
  const voiceError          = document.getElementById('voiceError');

  /* Text UI */
  const textFeedbackInput   = document.getElementById('textFeedbackInput');
  const btnCleanText        = document.getElementById('btnCleanTextWithGroq');
  const btnSubmitText       = document.getElementById('btnSubmitText');

  /* Success screens */
  const finalReviewQuote    = document.getElementById('finalReviewQuote');
  const btnCopyFinalText    = document.getElementById('btnCopyFinalText');
  const copyAlert           = document.getElementById('copyAlert');
  const btnGoogleReview     = document.getElementById('btnGoogleReview');
  const fileProtocolNotice  = document.getElementById('fileProtocolNotice');

  /* Lang selects */
  const inputLangSelect     = document.getElementById('inputLangSelect');
  const outputLangSelect    = document.getElementById('outputLangSelect');

  /* ── State ── */
  let selectedRating  = 0;
  let finalText       = '';
  let isRecording     = false;
  let recognition     = null;
  let timerInterval   = null;
  let timerSeconds    = 0;
  let rawTranscript   = '';

  /* ── Init ── */
  function init () {
    const urlParams     = new URLSearchParams(window.location.search);
    const hospitalParam = urlParams.get('hospital') || 'Tambaram Medical Center';

    if (elHospitalName) elHospitalName.textContent = hospitalParam;
    document.querySelectorAll('.hosp-name-placeholder').forEach(el => {
      el.textContent = hospitalParam;
    });

    const nameParam = urlParams.get('name') || urlParams.get('patient') || '';
    if (elPatientNameInput && nameParam) {
      elPatientNameInput.value = nameParam;
    }

    const phoneParam = urlParams.get('phone') || urlParams.get('phone_number') || urlParams.get('mobile') || '';
    if (elPatientPhoneInput && phoneParam) {
      elPatientPhoneInput.value = phoneParam;
    }

    if (window.location.protocol === 'file:' && fileProtocolNotice) {
      fileProtocolNotice.classList.remove('hidden');
    }

    setupStars();
    setupModeCards();
    setupQuickChips();
    setupMainSubmit();
    setupVoice();
    setupText();
    setupCopyButtons();
  }

  /* ── 0. Welcome Splash Animation (Smooth slow fade out if present) ── */
  function setupSplash () {
    const splash = document.getElementById('welcomeSplash');
    if (!splash) return;

    const timer = setTimeout(() => {
      closeSplash();
    }, 4000);

    function closeSplash () {
      clearTimeout(timer);
      splash.style.transition = 'opacity 1s ease-in-out, transform 1s ease-in-out';
      splash.style.opacity = '0';
      splash.style.transform = 'scale(0.95)';
      splash.style.pointerEvents = 'none';
      setTimeout(() => {
        splash.style.display = 'none';
      }, 1000);
    }
  }

  /* ── 1. Star Rating (1 to 5 with Individual Labels & Active Border Box) ── */
  function setupStars () {
    const starItems = document.querySelectorAll('.star-item, .star-btn');
    starItems.forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRating = parseInt(btn.dataset.star, 10);
        highlightStars(selectedRating);
      });

      btn.addEventListener('mouseenter', () => {
        const hoverCount = parseInt(btn.dataset.star, 10);
        starItems.forEach((b, idx) => {
          b.classList.toggle('active', (idx + 1) <= hoverCount);
        });
      });

      btn.addEventListener('mouseleave', () => {
        highlightStars(selectedRating);
      });
    });

    // Start with NOTHING selected on initial open
    selectedRating = 0;
    highlightStars(0);
  }

  function highlightStars (count) {
    const starItems = document.querySelectorAll('.star-item, .star-btn');
    starItems.forEach((btn, idx) => {
      const starNum = idx + 1;
      btn.classList.toggle('active', count > 0 && starNum <= count);
      btn.classList.toggle('selected-highlight', count > 0 && starNum === count);
    });
  }

  /* ── 2. Mode Cards (Speak / Type) ── */
  function setupModeCards () {
    if (btnVoiceMode) {
      btnVoiceMode.addEventListener('click', () => {
        const isVoiceVisible = voiceSection && !voiceSection.classList.contains('hidden');
        if (isVoiceVisible) {
          hideSection(voiceSection);
          btnVoiceMode.classList.remove('active');
        } else {
          showSection(voiceSection);
          hideSection(textSection);
          btnVoiceMode.classList.add('active');
          if (btnTextMode) btnTextMode.classList.remove('active');
          voiceSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    if (btnTextMode) {
      btnTextMode.addEventListener('click', () => {
        const isTextVisible = textSection && !textSection.classList.contains('hidden');
        if (isTextVisible) {
          hideSection(textSection);
          btnTextMode.classList.remove('active');
        } else {
          showSection(textSection);
          hideSection(voiceSection);
          btnTextMode.classList.add('active');
          if (btnVoiceMode) btnVoiceMode.classList.remove('active');
          if (textFeedbackInput) textFeedbackInput.focus();
          textSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    if (switchTextLink) {
      switchTextLink.addEventListener('click', () => {
        showSection(textSection);
        hideSection(voiceSection);
        if (btnTextMode) btnTextMode.classList.add('active');
        if (btnVoiceMode) btnVoiceMode.classList.remove('active');
        if (textFeedbackInput) textFeedbackInput.focus();
      });
    }

    if (switchVoiceLink) {
      switchVoiceLink.addEventListener('click', () => {
        showSection(voiceSection);
        hideSection(textSection);
        if (btnVoiceMode) btnVoiceMode.classList.add('active');
        if (btnTextMode) btnTextMode.classList.remove('active');
      });
    }
  }

  /* ── 2.5 Quick Feedback Chips (Multi-Select) ── */
  const selectedQuickChips = new Set();

  function setupQuickChips () {
    const chips = document.querySelectorAll('.quick-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const topic = chip.dataset.topic || chip.textContent.trim();
        if (chip.classList.contains('active')) {
          chip.classList.remove('active');
          selectedQuickChips.delete(topic);
        } else {
          chip.classList.add('active');
          selectedQuickChips.add(topic);
        }
      });
    });
  }

  /* ── 2.8 Main Submit Handler (Seamless Full Width Blue Button) ── */
  function setupMainSubmit () {
    const btn = document.getElementById('btnMainSubmit');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const patientName = elPatientNameInput ? elPatientNameInput.value.trim() : '';
      if (!patientName) {
        const nameErr = document.getElementById('nameStepError');
        if (nameErr) nameErr.classList.remove('hidden');
        if (elPatientNameInput) {
          elPatientNameInput.focus();
          const parentBox = elPatientNameInput.closest('.patient-input-box');
          if (parentBox) {
            parentBox.style.borderColor = '#ef4444';
            parentBox.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.2)';
            setTimeout(() => {
              parentBox.style.borderColor = '';
              parentBox.style.boxShadow = '';
            }, 1500);
          }
        }
        return;
      }

      if (!selectedRating) {
        alert('Please select a star rating (1 to 5 stars) for your visit.');
        const starBox = document.getElementById('starRatingBox');
        if (starBox) starBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      let submissionText = '';
      const cleanedVoice = cleanedReviewText ? cleanedReviewText.value.trim() : '';
      const typedText = textFeedbackInput ? textFeedbackInput.value.trim() : '';

      if (cleanedVoice) {
        submissionText = cleanedVoice;
      } else if (typedText) {
        btn.disabled = true;
        const origText = btn.innerHTML;
        btn.innerHTML = `
          <svg style="animation: spin 1s linear infinite; width: 16px; height: 16px; margin-right: 6px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          <span>Polishing Feedback...</span>
        `;
        try {
          const cleaned = await cleanWithGroq(typedText);
          submissionText = (cleaned && cleaned !== '(No feedback text)') ? cleaned : typedText;
        } catch (e) {
          submissionText = typedText;
        } finally {
          btn.disabled = false;
          btn.innerHTML = origText;
        }
      } else if (selectedQuickChips.size > 0) {
        const chipsArr = Array.from(selectedQuickChips);
        if (selectedRating >= 4) {
          submissionText = `The consultation at Tambaram Medical Center was very good. Specifically appreciated the ${chipsArr.join(', ')}.`;
        } else {
          submissionText = `Patient feedback regarding ${chipsArr.join(', ')} during hospital consultation.`;
        }
      } else {
        if (selectedRating === 5) {
          submissionText = 'Excellent treatment, caring doctors, and courteous staff at Tambaram Medical Center.';
        } else if (selectedRating === 4) {
          submissionText = 'Good experience with hospital care and doctors during my visit.';
        } else if (selectedRating === 3) {
          submissionText = 'Average hospital visit. Waiting time and consultation were acceptable.';
        } else {
          submissionText = 'Dissatisfied with the hospital visit and care experience.';
        }
      }

      submitReview(submissionText);
    });

    if (elPatientNameInput) {
      elPatientNameInput.addEventListener('input', () => {
        const nameErr = document.getElementById('nameStepError');
        if (nameErr) nameErr.classList.add('hidden');
      });
    }
  }

  function showSection (el) { if (el) el.classList.remove('hidden'); }
  function hideSection (el) { if (el) el.classList.add('hidden'); }

  /* ── 3. Dual-Engine Mobile & Desktop Voice Recording ── */
  let activeStream = null;
  let recordRTCInstance = null;
  let mediaRecorder = null;
  let recordedAudioChunks = [];
  let recordedMimeType = '';

  function isMobileBrowser () {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (typeof window !== 'undefined' && 'ontouchstart' in window && navigator.maxTouchPoints > 0);
  }

  function setupVoice () {
    if (!btnStartRecord) return;
    btnStartRecord.addEventListener('click', startRecording);
    if (btnStopRecord) btnStopRecord.addEventListener('click', stopRecording);
  }

  /* Audio Transcription via Groq Whisper AI (Flagship whisper-large-v3) */
  async function transcribeAudioWithWhisper (audioBlob, langCode) {
    try {
      if (!audioBlob || audioBlob.size < 200) return '';
      const formData = new FormData();
      let ext = 'wav';
      const mime = (audioBlob.type || recordedMimeType || '').toLowerCase();
      if (mime.includes('wav')) {
        ext = 'wav';
      } else if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) {
        ext = 'm4a';
      } else if (mime.includes('ogg')) {
        ext = 'ogg';
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
          'Authorization': 'Bearer ' + GROQ_API_KEY
        },
        body: formData
      });

      if (resp.ok) {
        const data = await resp.json();
        return (data.text || '').trim();
      } else {
        const errJson = await resp.json().catch(() => ({}));
        console.warn('Groq Whisper STT API returned error:', resp.status, errJson);
      }
    } catch (err) {
      console.warn('Groq Whisper STT network error:', err);
    }
    return '';
  }

  async function startRecording () {
    if (voiceError) voiceError.classList.add('hidden');
    if (liveTextPreview) liveTextPreview.textContent = 'Listening… speak now';

    rawTranscript = '';
    recordedAudioChunks = [];
    isRecording = true;
    timerSeconds = 0;

    const selectedLangCode = inputLangSelect ? inputLangSelect.value : 'ta-IN';
    const isMobile = isMobileBrowser();

    // 1. Request microphone stream with mobile-optimized acoustic tuning
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        activeStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: false, // Avoid mobile DSP aggressively clipping soft Tamil syllables/consonants
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 16000
          }
        });

        // Use RecordRTC (StereoAudioRecorder) to capture 16kHz WAV on mobile & desktop
        if (typeof RecordRTC !== 'undefined') {
          recordRTCInstance = new RecordRTC(activeStream, {
            type: 'audio',
            mimeType: 'audio/wav',
            recorderType: RecordRTC.StereoAudioRecorder,
            numberOfAudioChannels: 1, // Mono (crystal clear speech, lightweight)
            desiredSampRate: 16000,   // 16kHz native Whisper sampling rate
            bufferSize: 4096,         // Eliminates audio glitches/underruns on mobile CPUs
            timeSlice: 1000
          });
          recordRTCInstance.startRecording();
          recordedMimeType = 'audio/wav';
        } else if (typeof MediaRecorder !== 'undefined') {
          // Fallback to native MediaRecorder
          let mimeType = '';
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
          else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';

          recordedMimeType = mimeType;
          mediaRecorder = mimeType
            ? new MediaRecorder(activeStream, { mimeType })
            : new MediaRecorder(activeStream);

          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              recordedAudioChunks.push(e.data);
            }
          };
          mediaRecorder.start(250);
        }
      }
    } catch (err) {
      console.warn('Microphone permission warning:', err);
      if (voiceError) {
        voiceError.classList.remove('hidden');
        voiceError.innerHTML = '⚠️ <strong>Microphone access blocked.</strong> Please click the lock or settings icon in your browser address bar and set Microphone to <strong>"Allow"</strong>, then try again.';
      }
      isRecording = false;
      return;
    }

    // 2. Start Web Speech API ONLY on Desktop for real-time live preview
    if (!isMobile) {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionClass) {
        try {
          recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = selectedLangCode;

          recognition.onresult = (event) => {
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
            rawTranscript = (finalStr + (interimStr ? ' ' + interimStr : '')).trim();
            if (liveTextPreview) {
              liveTextPreview.textContent = rawTranscript || 'Listening…';
            }
            if (rawTranscriptBox) {
              rawTranscriptBox.classList.remove('hidden');
            }
            if (rawTranscriptText) {
              rawTranscriptText.textContent = rawTranscript || 'Listening…';
            }
          };

          recognition.onerror = (event) => {
            if (event.error === 'no-speech') return;
            console.warn('[WebSpeech API] Notice:', event.error);
          };

          recognition.onend = () => {
            if (isRecording && recognition) {
              try { recognition.start(); } catch (e) {}
            }
          };

          recognition.start();
        } catch (errRec) {
          console.warn('Web Speech API start error:', errRec);
        }
      }
    } else {
      // Mobile user guidance
      if (liveTextPreview) liveTextPreview.textContent = '🎙️ Recording voice... Speak clearly';
      if (rawTranscriptText) rawTranscriptText.textContent = '🎙️ Listening... Tap "Stop Recording" when you are done speaking.';
    }

    // 3. UI State & Timer
    if (micIdleState)      micIdleState.classList.add('hidden');
    if (micRecordingState) micRecordingState.classList.remove('hidden');
    if (rawTranscriptBox)  rawTranscriptBox.classList.remove('hidden');
    if (!isMobile && rawTranscriptText) rawTranscriptText.textContent = 'Listening... Speak a word to see it here live';

    timerInterval = setInterval(() => {
      timerSeconds++;
      const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
      const s = String(timerSeconds % 60).padStart(2, '0');
      if (recordingTimer) recordingTimer.textContent = m + ':' + s;
    }, 1000);
  }

  /* Filter Whisper hallucinations, silence tokens, and noise */
  function isNonsenseOrSilence (text) {
    if (!text) return true;
    const trimmed = text.trim();
    if (trimmed.length < 3) return true;

    // Repetitive identical letters/words (e.g. "ர ர", "ரர", "ஆ ஆ", "ha ha")
    const words = trimmed.split(/\s+/);
    if (words.length <= 3 && words.every(w => w === words[0]) && trimmed.length <= 8) {
      return true;
    }

    // Repeated single character like "ரரரர", "aaaa"
    if (/^(.)\1+$/.test(trimmed.replace(/\s+/g, ''))) {
      return true;
    }

    // Known Whisper silence/noise hallucinations
    const silenceHallucinations = [
      'ர ர', 'ரர', 'ர', 'ஆ ஆ', 'ஆ', 'த த', '...', '....', '---',
      'thank you', 'thank you.', 'thanks for watching', 'thanks for watching.',
      'subscribe', 'subtitles by', 'you', 'bye', 'so', 'oh', 'uh', 'um',
      'please subscribe', 'mbc', 'amara.org'
    ];
    if (silenceHallucinations.includes(trimmed.toLowerCase())) {
      return true;
    }

    // Only punctuation or special symbols
    if (!/[\p{L}\p{N}]/u.test(trimmed)) {
      return true;
    }

    return false;
  }

  async function stopRecording () {
    isRecording = false;
    clearInterval(timerInterval);

    // Stop Web Speech Recognition if active
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }

    if (micRecordingState) micRecordingState.classList.add('hidden');
    if (micCleaningState)  micCleaningState.classList.remove('hidden');

    // Graceful 350ms buffer flush so the user's trailing syllable is not truncated
    await new Promise((r) => setTimeout(r, 350));

    // Stop Recording and safely gather audio blob (RecordRTC first, then native fallback)
    let audioBlob = null;
    if (recordRTCInstance) {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          try { audioBlob = recordRTCInstance.getBlob(); } catch (e) {}
          resolve();
        }, 2000);

        recordRTCInstance.stopRecording(() => {
          clearTimeout(timeout);
          try {
            audioBlob = recordRTCInstance.getBlob();
          } catch (e) {}
          resolve();
        });
      });
      try { recordRTCInstance.destroy(); } catch (e) {}
      recordRTCInstance = null;
    } else if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (recordedAudioChunks.length > 0) {
            try { audioBlob = new Blob(recordedAudioChunks, { type: recordedMimeType || 'audio/webm' }); } catch (e) {}
          }
          resolve();
        }, 1500);

        mediaRecorder.onstop = () => {
          clearTimeout(timeout);
          try {
            audioBlob = new Blob(recordedAudioChunks, { type: recordedMimeType || 'audio/webm' });
          } catch (e) {}
          resolve();
        };

        try {
          if (typeof mediaRecorder.requestData === 'function') {
            mediaRecorder.requestData();
          }
          mediaRecorder.stop();
        } catch (e) {
          clearTimeout(timeout);
          resolve();
        }
      });
    } else if (recordedAudioChunks.length > 0) {
      audioBlob = new Blob(recordedAudioChunks, { type: recordedMimeType || 'audio/webm' });
    }

    // Release microphone hardware tracks
    if (activeStream) {
      try {
        activeStream.getTracks().forEach(t => t.stop());
      } catch (e) {}
      activeStream = null;
    }

    const selectedLangCode = inputLangSelect ? inputLangSelect.value : 'ta-IN';
    const webSpeechText = (rawTranscript || '').trim();
    let chosenTranscript = '';

    // Prioritize Groq Whisper AI (whisper-large-v3-turbo) whenever audio is recorded
    if (audioBlob && audioBlob.size > 200) {
      if (liveTextPreview) liveTextPreview.textContent = 'Transcribing voice with AI…';
      if (rawTranscriptText) rawTranscriptText.textContent = '⚡ Transcribing your voice with Groq Whisper AI...';
      const whisperTranscript = await transcribeAudioWithWhisper(audioBlob, selectedLangCode);

      const whisperIsReal = whisperTranscript && !isNonsenseOrSilence(whisperTranscript);
      const webSpeechIsReal = webSpeechText && !isNonsenseOrSilence(webSpeechText);

      if (whisperIsReal) {
        chosenTranscript = whisperTranscript.trim();
      } else if (webSpeechIsReal) {
        chosenTranscript = webSpeechText;
      } else {
        chosenTranscript = ''; // Both are noise/silence
      }
    } else if (webSpeechText && !isNonsenseOrSilence(webSpeechText)) {
      chosenTranscript = webSpeechText;
    }

    rawTranscript = chosenTranscript;

    if (rawTranscript && rawTranscript.trim().length > 0) {
      if (rawTranscriptBox)  rawTranscriptBox.classList.remove('hidden');
      if (rawTranscriptText) rawTranscriptText.textContent = rawTranscript;

      // AI Translation & Polish into professional review
      const cleaned = await cleanWithGroq(rawTranscript);

      if (micCleaningState) micCleaningState.classList.add('hidden');

      if (!cleaned || cleaned === '(No feedback text)') {
        if (micIdleState) micIdleState.classList.remove('hidden');
        if (rawTranscriptBox) rawTranscriptBox.classList.remove('hidden');
        if (rawTranscriptText) rawTranscriptText.textContent = '⚠️ Could not detect clear words. Please tap the mic and speak clearly.';
        if (cleanedReviewBox) cleanedReviewBox.classList.add('hidden');
        if (btnSubmitVoice) btnSubmitVoice.classList.add('hidden');
        return;
      }

      finalText = cleaned;
      if (cleanedReviewBox)  cleanedReviewBox.classList.remove('hidden');
      if (cleanedReviewText) cleanedReviewText.value = cleaned;
      if (btnSubmitVoice)    btnSubmitVoice.classList.remove('hidden');
    } else {
      if (micCleaningState)  micCleaningState.classList.add('hidden');
      if (micIdleState)      micIdleState.classList.remove('hidden');
      if (rawTranscriptBox)  rawTranscriptBox.classList.remove('hidden');
      if (rawTranscriptText) rawTranscriptText.textContent = '⚠️ No speech detected. Please speak closer to your microphone and try again.';
      if (cleanedReviewBox)  cleanedReviewBox.classList.add('hidden');
      if (btnSubmitVoice)    btnSubmitVoice.classList.add('hidden');
    }
  }

  /* ── 4. Text Feedback ── */
  function setupText () {
    if (btnCleanText) {
      btnCleanText.addEventListener('click', async () => {
        const raw = textFeedbackInput ? textFeedbackInput.value.trim() : '';
        if (!raw) return;
        const cleaned = await cleanWithGroq(raw);
        finalText = cleaned;
        if (textFeedbackInput) textFeedbackInput.value = cleaned;
      });
    }

    if (btnSubmitText) {
      btnSubmitText.addEventListener('click', async () => {
        const raw = textFeedbackInput ? textFeedbackInput.value.trim() : '';
        if (!raw) {
          alert('Please enter your feedback before submitting.');
          return;
        }

        const originalContent = btnSubmitText.innerHTML;
        btnSubmitText.disabled = true;
        btnSubmitText.innerHTML = `
          <svg style="animation: spin 1s linear infinite; width: 16px; height: 16px; margin-right: 6px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          <span>Polishing & Submitting...</span>
        `;

        try {
          const cleaned = await cleanWithGroq(raw);
          finalText = (cleaned && cleaned !== '(No feedback text)') ? cleaned : raw;
        } catch (err) {
          console.warn('Auto clean failed, submitting original text:', err);
          finalText = raw;
        } finally {
          btnSubmitText.disabled = false;
          btnSubmitText.innerHTML = originalContent;
        }

        submitReview(finalText);
      });
    }

    if (btnSubmitVoice) {
      btnSubmitVoice.addEventListener('click', () => {
        if (cleanedReviewText) finalText = cleanedReviewText.value.trim();
        submitReview(finalText);
      });
    }
  }

  /* ── 5. AI Translation & Cleaning ── */
  async function cleanWithGroq (rawText) {
    if (!rawText || !rawText.trim() || isNonsenseOrSilence(rawText)) return '(No feedback text)';

    const targetLang = outputLangSelect ? outputLangSelect.value : 'English';
    const sourceLang = inputLangSelect ? (inputLangSelect.options[inputLangSelect.selectedIndex]?.text || 'Tamil') : 'Tamil';
    const sourceCode = inputLangSelect ? inputLangSelect.value.split('-')[0] : 'ta';

    const targetCodeMap = {
      'English': 'en',
      'Tamil': 'ta',
      'Hindi': 'hi',
      'Telugu': 'te',
      'Kannada': 'kn',
      'Malayalam': 'ml'
    };
    const targetCode = targetCodeMap[targetLang] || 'en';

    // Flagship Groq AI models cascade: GPT-OSS 120B (Best) -> Qwen 27B -> GPT-OSS 20B
    const models = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];

    const isEnglish = sourceCode === 'en' && targetCode === 'en';
    const promptContent = isEnglish
      ? `You are an expert grammar and language correction assistant.
The user provided voice feedback:
"${rawText}"

Your ONLY task is to correct grammar, punctuation, spelling, sentence capitalization, and remove vocal fillers (e.g., um, uh, ah).
STRICT RULES:
1. ONLY GRAMMAR CHANGES - NO CONTENT CHANGES: Do NOT change, add, rephrase, elaborate, or omit any thoughts, words, details, meaning, or sentiments.
2. DO NOT INVENT: Do NOT add praise, complaints, or sentences that the user did not say.
3. Keep the user's exact words and natural phrasing, applying ONLY necessary grammatical and punctuation corrections.
4. If the text has no meaningful feedback or is gibberish, return EXACTLY: (No feedback detected)
5. Return ONLY the clean, corrected text with no quotation marks, markdown, apologies, or explanations.`
      : `You are an expert English healthcare feedback translator and editor.
The user is a PATIENT providing spoken feedback about their hospital / clinic visit in conversational ${sourceLang} / Tanglish:
"${rawText}"

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

    for (const model of models) {
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + GROQ_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [{
              role: 'user',
              content: promptContent
            }],
            temperature: 0.1,
            max_tokens: 300
          })
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
              return '(No feedback text)';
            }
            return cleaned;
          }
        } else {
          console.warn(`Groq ${model} response not ok:`, resp.status);
        }
      } catch (err) {
        console.warn(`Groq ${model} fetch error:`, err);
      }
    }

    return '(No feedback text)';
  }

  /* ── 6. Submit Review ── */
  async function submitReview (text) {
    if (!selectedRating) {
      alert('Please select a star rating first.');
      return;
    }

    finalText = text || '(No feedback text provided)';
    const patientName = elPatientNameInput ? elPatientNameInput.value.trim() : 'Anonymous Patient';
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token') || '';
    const hospitalParam = urlParams.get('hospital') || 'Tambaram Medical Center';
    const hospitalId = urlParams.get('hospital_id') || '11111111-1111-1111-1111-111111111111';

    // Robust NLP sentiment detection:
    // If text expresses dissatisfaction or complaints, sentiment is strictly NEGATIVE regardless of star rating
    const textLower = finalText.toLowerCase();
    let sentiment = 'neutral';
    const negativeKeywords = /\b(dissatisfied|dissatisfaction|dislike|disliked|unhappy|displeased|poor|bad|worst|terrible|horrible|rude|arrogant|unprofessional|inattentive|unfriendly|careless|negligent|dirty|unhygienic|slow|late|delay|delayed|waste|useless|cheat|scam|overcharg|pain|suffering|fell short|not good|not proper|not satisfied|not comfortable|not happy|did not like|didn't like|dont like|don't like|neither|neither good|not recommended|unacceptable|problem|issue|complaint)\b|புடிக்கல|பிடிக்கவில்லை|மோசம்|சரியா இல்ல|ரொம்ப லேட்/i;
    const positiveKeywords = /\b(excellent|exceptional|superb|wonderful|fantastic|amazing|great|good|loved|enjoyed|satisfied|satisfaction|caring|polite|helpful|friendly|smooth|best|super|nice|prompt|neat|hygienic|clean|recommend)\b|நல்லா|சூப்பர்|புடிக்கும்|பிடிக்கும்/i;

    if (negativeKeywords.test(textLower)) {
      sentiment = 'negative';
    } else if (positiveKeywords.test(textLower) && !/\b(not|never|no|hardly|barely|without)\b/i.test(textLower)) {
      sentiment = 'positive';
    } else {
      if (selectedRating >= 4) sentiment = 'positive';
      else if (selectedRating <= 2) sentiment = 'negative';
      else sentiment = 'neutral';
    }

    let topic = 'General Hospital Experience';
    if (selectedQuickChips && selectedQuickChips.size > 0) {
      topic = Array.from(selectedQuickChips).join(', ');
    } else if (/\b(wait|hour|delayed?|queue|late|slow)\b/i.test(textLower)) {
      topic = 'Wait Time & Queue Management';
    } else if (/\b(bill|charge|cost|money|insurance|counter|receipt|admin)\b/i.test(textLower)) {
      topic = 'Billing & Administration';
    } else if (/\b(doctor|dr|treatment|surgery|consultation|medicine)\b/i.test(textLower)) {
      topic = 'Doctor & Clinical Consultation';
    } else if (/\b(nurse|staff|hospitality|sister|emergency|ward)\b/i.test(textLower)) {
      topic = 'Nursing & Emergency Hospitality';
    } else if (/\b(clean|hygiene|room|toilet|washroom|facility)\b/i.test(textLower)) {
      topic = 'Hospital Cleanliness & Facilities';
    }

    const phoneParam = (elPatientPhoneInput && elPatientPhoneInput.value.trim()) || urlParams.get('phone') || urlParams.get('phone_number') || urlParams.get('mobile') || '';

    // RULE: 4-5 stars with POSITIVE feedback ONLY can post to Google Reviews.
    // 1-5 stars with NEGATIVE, or 1-3 stars with POSITIVE/NEUTRAL, are stored to internal hospital feedback only.
    const isGoogleReview = (selectedRating >= 4 && sentiment === 'positive');

    const payload = {
      id:               'tmc-' + Date.now(),
      hospital_id:      hospitalId,
      hospital_name:    hospitalParam,
      visit_id:         tokenParam || ('visit-' + Date.now()),
      token:            tokenParam,
      patient_id:       patientName || 'Anonymous Patient',
      patient_name:     patientName || 'Anonymous Patient',
      phone:            phoneParam,
      phone_number:     phoneParam,
      rating:           Number(selectedRating),
      sentiment:        sentiment,
      healthcare_topic: topic,
      feedback_text:    finalText,
      quick_feedback_tags: Array.from(selectedQuickChips || []),
      whatsapp_status:  'read',
      review_channel:   isGoogleReview ? 'google_review' : 'web',
      is_google_review: isGoogleReview,
      google_review_posted: isGoogleReview,
      submitted_at:     new Date().toISOString()
    };

    // Save to Firebase RTDB in real-time for staff dashboard
    try {
      await fetch(FIREBASE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload)
      });
      console.log('Feedback saved to Firebase Realtime Database successfully.');

      // Dynamically update patient and visit records in Firebase RTDB
      await syncPatientAndVisitToFirebase(payload);
    } catch (err) {
      console.error('Failed to save to Firebase:', err);
    }

    if (isGoogleReview) {
      /* 4-5 Stars with strictly POSITIVE feedback → Google Review Screen */
      const positiveMsgEl = document.getElementById('positiveSuccessMessage');
      if (positiveMsgEl) {
        positiveMsgEl.textContent =
          'Thank you for your valuable feedback. We’re glad to know you had a positive experience with our hospital and care team. Your kind words motivate us to continue providing the best care.';
      }

      if (finalReviewQuote) finalReviewQuote.textContent = finalText;
      
      /* Auto-copy to clipboard */
      if (finalText && navigator.clipboard) {
        navigator.clipboard.writeText(finalText).then(() => {
          if (copyAlert) {
            copyAlert.classList.remove('hidden');
            setTimeout(() => copyAlert.classList.add('hidden'), 4000);
          }
        }).catch(() => {});
      }
      
      showScreen(highRatingScreen);
    } else {
      /* 1-5 Stars with NEGATIVE, or 1-3 Stars with POSITIVE/NEUTRAL → Dedicated Hospital Internal Care / Apology Screen */
      const lowTitleEl = document.getElementById('lowRatingTitle');
      const lowMsgEl = document.getElementById('lowRatingMessageText');

      if (sentiment === 'negative' || selectedRating <= 2) {
        if (lowTitleEl) lowTitleEl.textContent = 'We Sincerely Apologize';
        if (lowMsgEl) {
          lowMsgEl.textContent =
            'We sincerely apologize for your experience and appreciate you bringing this to our attention. We are reviewing your feedback and taking steps to improve our services so that this does not happen again.';
        }
      } else {
        if (lowTitleEl) lowTitleEl.textContent = 'Thank You for Your Feedback';
        if (lowMsgEl) {
          lowMsgEl.textContent =
            'Thank you for sharing your feedback with us. We have carefully noted your suggestions and will continue working to improve your experience and our services.';
        }
      }

      showScreen(lowRatingScreen);
    }
  }

  /* ── 7. Copy Buttons ── */
  function setupCopyButtons () {
    if (btnCopyCleaned && cleanedReviewText) {
      btnCopyCleaned.addEventListener('click', () => {
        navigator.clipboard.writeText(cleanedReviewText.value).catch(() => {});
      });
    }

    if (btnCopyFinalText && finalReviewQuote) {
      btnCopyFinalText.addEventListener('click', () => {
        const textToCopy = finalReviewQuote.textContent || finalText || '';
        navigator.clipboard.writeText(textToCopy).then(() => {
          if (copyAlert) {
            copyAlert.classList.remove('hidden');
            setTimeout(() => copyAlert.classList.add('hidden'), 3000);
          }
        }).catch(() => {});
      });
    }

    if (btnGoogleReview) {
      btnGoogleReview.href = GOOGLE_REVIEW;
      btnGoogleReview.addEventListener('click', () => {
        const textToCopy = finalReviewQuote?.textContent || finalText || '';
        if (textToCopy && navigator.clipboard) {
          navigator.clipboard.writeText(textToCopy).catch(() => {});
        }
        // Dispatch Google Review click confirmation to Firebase RTDB
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const patientName = (elPatientNameInput && elPatientNameInput.value.trim()) || urlParams.get('patient') || urlParams.get('name') || 'Anonymous Patient';
          const phoneParam = (elPatientPhoneInput && elPatientPhoneInput.value.trim()) || urlParams.get('phone') || urlParams.get('phone_number') || urlParams.get('mobile') || '';
          const tokenParam = urlParams.get('token') || '';
          const hospitalParam = urlParams.get('hospital') || 'Tambaram Medical Center';
          const hospitalId = urlParams.get('hospital_id') || '11111111-1111-1111-1111-111111111111';
          const currentRating = Number(selectedRating) || 5;
          const currentFeedbackText = (cleanedReviewText && cleanedReviewText.value.trim()) || (finalReviewQuote && finalReviewQuote.textContent.trim()) || finalText || 'Submitted 5-star Google Review';

          const gPayload = {
            id: 'gclick-' + Date.now(),
            visit_id: tokenParam || ('visit-' + Date.now()),
            token: tokenParam,
            patient_id: patientName,
            patient_name: patientName,
            phone: phoneParam,
            phone_number: phoneParam,
            hospital_id: hospitalId,
            hospital_name: hospitalParam,
            rating: currentRating,
            feedback_text: currentFeedbackText,
            sentiment: 'positive',
            healthcare_topic: 'Google Verified Review',
            status: 'completed',
            review_channel: 'google_review',
            google_review_posted: true,
            is_google_review: true,
            whatsapp_status: 'read',
            submitted_at: new Date().toISOString()
          };

          fetch(FIREBASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gPayload)
          }).catch(() => {});

          syncPatientAndVisitToFirebase(gPayload).catch(() => {});
        } catch (e) {}
      });
    }
  }

  /* ── Dynamic Firebase RTDB Sync for Patient & Visit ── */
  async function syncPatientAndVisitToFirebase(data) {
    const FIREBASE_BASE = 'https://rescuebridge-fe59b-default-rtdb.firebaseio.com';
    try {
      const pPhoneClean = (data.phone || data.phone_number || '').replace(/\D/g, '').slice(-10);
      const pNameClean = (data.patient_name || data.patient_id || '').toLowerCase().trim();
      const numRating = Number(data.rating) || 5;
      const isGoogle = Boolean(data.google_review_posted || data.is_google_review || numRating >= 4);

      // 1. Fetch patients to find matching record
      const patientsRes = await fetch(`${FIREBASE_BASE}/patients.json`);
      const patientsData = (await patientsRes.json()) || {};
      let matchedPatientKey = null;

      for (const [key, p] of Object.entries(patientsData)) {
        if (!p) continue;
        const phone = (p.phone || '').replace(/\D/g, '').slice(-10);
        const name = (p.name || '').toLowerCase().trim();
        const phoneMatches = Boolean(pPhoneClean && phone && phone === pPhoneClean);
        const nameMatches = Boolean(pNameClean && name && (name === pNameClean || name.includes(pNameClean) || pNameClean.includes(name)));
        if (pNameClean && pNameClean !== 'anonymous patient' && pNameClean !== 'valued patient') {
          if (phoneMatches && nameMatches) {
            matchedPatientKey = key;
            break;
          }
        } else if (phoneMatches) {
          matchedPatientKey = key;
          break;
        }
      }

      const patientUpdate = {
        rating: numRating,
        review_status: 'completed',
        review_sent: true,
        review_channel: isGoogle ? 'google_review' : 'web',
        google_review_posted: isGoogle,
        is_google_review: isGoogle,
        feedback_text: data.feedback_text || null,
        review_submitted_at: data.submitted_at || new Date().toISOString(),
        sentiment: data.sentiment || 'positive',
        healthcare_topic: data.healthcare_topic || 'General Hospital Experience'
      };

      if (matchedPatientKey) {
        await fetch(`${FIREBASE_BASE}/patients/${encodeURIComponent(matchedPatientKey)}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patientUpdate)
        });
      }

      // 2. Fetch visits to find matching record
      const visitsRes = await fetch(`${FIREBASE_BASE}/visits.json`);
      const visitsData = (await visitsRes.json()) || {};
      let matchedVisitKey = null;

      for (const [key, v] of Object.entries(visitsData)) {
        if (!v) continue;
        if (data.token && (v.token === data.token || key === data.token)) {
          matchedVisitKey = key;
          break;
        }
        if (data.visit_id && (v.id === data.visit_id || v.visit_uid === data.visit_id || key === data.visit_id)) {
          matchedVisitKey = key;
          break;
        }
      }

      const visitUpdate = {
        status: 'completed',
        rating: numRating,
        is_reviewed: true,
        review_requested: true
      };

      if (matchedVisitKey) {
        await fetch(`${FIREBASE_BASE}/visits/${encodeURIComponent(matchedVisitKey)}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(visitUpdate)
        });
      }
    } catch (err) {
      console.warn('Error syncing patient and visit in Firebase:', err);
    }
  }

  /* ── Helpers ── */
  function showScreen (el) {
    [ratingScreen, highRatingScreen, lowRatingScreen].forEach(s => {
      if (s) s.classList.add('hidden');
      if (s) s.classList.remove('active');
    });
    if (el) {
      el.classList.remove('hidden');
      el.classList.add('active');
    }
  }

  /* ── Run ── */
  init();

})();
