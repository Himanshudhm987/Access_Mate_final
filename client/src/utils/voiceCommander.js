/**
 * VoiceCommander — High Performance Real-time Speech-to-Intent Controller
 * Features:
 * - Instant zero-delay matching with interimResults streaming
 * - Non-blocking execution with action cooldowns
 * - Auto-reconnecting continuous listening engine for PC and Mobile
 * - Speech synthesis collision handling
 */

export class VoiceCommander {
  constructor(getHandlers) {
    this.getHandlers = typeof getHandlers === 'function' ? getHandlers : () => getHandlers;
    this.recognition = null;
    this.isListening = false;
    this.lastTriggerTime = 0;
    this.lastTriggeredCommand = '';
    this.restartTimeout = null;
    this.cooldownMs = 1200; // Prevent duplicate rapid executions of the same command

    const SpeechRec =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null;

    this.SpeechRecognition = SpeechRec;
    this.supported = Boolean(SpeechRec);

    this.initRecognition();
  }

  get handlers() {
    return this.getHandlers();
  }

  initRecognition() {
    if (!this.supported) return;

    try {
      this.recognition = new this.SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true; // Realtime zero-delay streaming
      this.recognition.maxAlternatives = 1;
      
      // Use device default language or fallback to en-US
      this.recognition.lang = navigator.language && navigator.language.startsWith('en')
        ? navigator.language
        : 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.handlers.onStateChange?.(true);
      };

      this.recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        const cleanTranscript = transcript.trim().toLowerCase();
        if (cleanTranscript) {
          this.handlers.onTranscript?.(cleanTranscript);
          this.evaluateIntent(cleanTranscript);
        }
      };

      this.recognition.onerror = (event) => {
        // 'no-speech' is routine in ambient environments, ignore
        if (event.error === 'no-speech') {
          return;
        }

        console.warn('[VoiceCommander] Recognition event:', event.error);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.isListening = false;
          this.handlers.onStateChange?.(false);
          this.handlers.onError?.('Microphone access blocked. Please tap allow in your browser URL bar.');
        }
      };

      this.recognition.onend = () => {
        // Resilient auto-restart for mobile browsers that drop connection after quiet intervals
        if (this.isListening) {
          clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.isListening) {
              try {
                this.recognition.start();
              } catch {
                // If start fails, retry after a short pause
                setTimeout(() => {
                  if (this.isListening) {
                    try { this.recognition.start(); } catch {}
                  }
                }, 400);
              }
            }
          }, 150);
        } else {
          this.handlers.onStateChange?.(false);
        }
      };
    } catch (err) {
      console.error('[VoiceCommander] Failed initializing speech recognition:', err);
      this.supported = false;
    }
  }

  speakFeedback(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      // Do not interrupt if active text reading is in progress, unless it's a stop command
      const isCurrentlyReading = window.speechSynthesis.speaking;
      if (isCurrentlyReading && text !== 'Stopped') {
        return;
      }
      const feedback = new SpeechSynthesisUtterance(text);
      feedback.rate = 1.15;
      feedback.volume = 0.8;
      feedback.lang = 'en-US';
      window.speechSynthesis.speak(feedback);
    } catch {}
  }

  canExecute(commandKey) {
    const now = Date.now();
    if (this.lastTriggeredCommand === commandKey && now - this.lastTriggerTime < this.cooldownMs) {
      return false;
    }
    this.lastTriggerTime = now;
    this.lastTriggeredCommand = commandKey;
    return true;
  }

  matchAndExecute(phrase) {
    this.evaluateIntent(phrase);
  }

  evaluateIntent(phrase) {
    const p = phrase.toLowerCase();

    // 1. Stop Speech (Immediate priority - works even during reading)
    if (
      p.includes('stop') ||
      p.includes('shut up') ||
      p.includes('quiet') ||
      p.includes('halt') ||
      p.includes('ruk')
    ) {
      if (this.canExecute('stop')) {
        this.speakFeedback('Stopped');
        this.handlers.onStopSpeech?.();
      }
      return;
    }

    // 2. Pause
    if (p.includes('pause') || p.includes('wait')) {
      if (this.canExecute('pause')) {
        this.handlers.onPause?.();
      }
      return;
    }

    // 3. Resume
    if (p.includes('resume') || p.includes('continue')) {
      if (this.canExecute('resume')) {
        this.handlers.onResume?.();
      }
      return;
    }

    // 4. Open File / Browse Folder on PC or Phone
    if (
      p.includes('open file') ||
      p.includes('pick document') ||
      p.includes('pick file') ||
      p.includes('choose file') ||
      p.includes('choose image') ||
      p.includes('choose document') ||
      p.includes('upload') ||
      p.includes('select file') ||
      p.includes('select image') ||
      p.includes('select photo') ||
      p.includes('browse') ||
      p.includes('from folder') ||
      p.includes('open folder') ||
      p.includes('gallery')
    ) {
      if (this.canExecute('open_file')) {
        this.speakFeedback('Opening file selector');
        this.handlers.onOpenFile?.();
      }
      return;
    }

    // 5. Pick up last image / reload previous document
    if (
      p.includes('last image') ||
      p.includes('pick up my last') ||
      p.includes('last document') ||
      p.includes('open last') ||
      p.includes('recent image') ||
      p.includes('recent document') ||
      p.includes('previous image') ||
      p.includes('reload image')
    ) {
      if (this.canExecute('last_image')) {
        this.speakFeedback('Loading your last image');
        this.handlers.onPickLastImage?.();
      }
      return;
    }

    // 6. Extract text / OCR Scan
    if (
      p.includes('extract text') ||
      p.includes('extract') ||
      p.includes('scan text') ||
      p.includes('scan image') ||
      p.includes('scan') ||
      p.includes('run ocr') ||
      p.includes('recognize')
    ) {
      if (this.canExecute('extract')) {
        this.speakFeedback('Extracting text');
        this.handlers.onExtractText?.();
      }
      return;
    }

    // 7. Read Aloud / Speak
    if (
      p.includes('read aloud') ||
      p.includes('read document') ||
      p.includes('read text') ||
      p.includes('start reading') ||
      p.includes('read') ||
      p.includes('speak') ||
      p.includes('padho') ||
      p.includes('sunao')
    ) {
      if (this.canExecute('read')) {
        this.speakFeedback('Reading aloud');
        this.handlers.onSpeak?.();
      }
      return;
    }

    // 8. Save Document
    if (
      p.includes('save document') ||
      p.includes('save text') ||
      p.includes('save file') ||
      p.includes('save')
    ) {
      if (this.canExecute('save')) {
        this.speakFeedback('Saving document');
        this.handlers.onSaveDocument?.();
      }
      return;
    }

    // 9. Copy Text
    if (p.includes('copy text') || p.includes('copy')) {
      if (this.canExecute('copy')) {
        this.speakFeedback('Text copied');
        this.handlers.onCopyText?.();
      }
      return;
    }

    // 10. Clear Document
    if (p.includes('clear document') || p.includes('clear text') || p.includes('clear') || p.includes('reset')) {
      if (this.canExecute('clear')) {
        this.speakFeedback('Cleared');
        this.handlers.onClear?.();
      }
      return;
    }

    // 11. Theme Controls
    if (p.includes('dark mode') || p.includes('theme dark')) {
      if (this.canExecute('theme_dark')) {
        this.speakFeedback('Dark mode activated');
        this.handlers.onSetTheme?.('dark');
      }
      return;
    }

    if (p.includes('light mode') || p.includes('theme light')) {
      if (this.canExecute('theme_light')) {
        this.speakFeedback('Light mode activated');
        this.handlers.onSetTheme?.('light');
      }
      return;
    }

    if (p.includes('high contrast') || p.includes('contrast mode')) {
      if (this.canExecute('theme_contrast')) {
        this.speakFeedback('High contrast activated');
        this.handlers.onSetTheme?.('contrast');
      }
      return;
    }

    // 12. Translator Tool
    if (p.includes('translate') || p.includes('translation')) {
      if (this.canExecute('translate')) {
        this.speakFeedback('Opening translator');
        this.handlers.onTranslate?.();
      }
      return;
    }

    // 13. Navigation
    if (p.includes('go home') || p.includes('open home')) {
      if (this.canExecute('nav_home')) {
        this.handlers.onNavigate?.('home');
      }
      return;
    }
    if (p.includes('open reader') || p.includes('ocr studio')) {
      if (this.canExecute('nav_reader')) {
        this.handlers.onNavigate?.('reader');
      }
      return;
    }
    if (p.includes('open settings') || p.includes('accessibility')) {
      if (this.canExecute('nav_settings')) {
        this.handlers.onNavigate?.('settings');
      }
      return;
    }
  }

  start() {
    if (!this.supported) {
      this.handlers.onError?.('Voice recognition is not supported in this browser. Please use Google Chrome, Edge, or Safari.');
      return;
    }

    if (this.isListening) return;

    this.isListening = true;
    try {
      this.recognition.start();
      this.handlers.onStateChange?.(true);
    } catch (err) {
      console.warn('[VoiceCommander] Start error:', err);
    }
  }

  stop() {
    this.isListening = false;
    clearTimeout(this.restartTimeout);
    if (!this.supported) return;

    try {
      this.recognition.stop();
      this.handlers.onStateChange?.(false);
    } catch {}
  }

  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }
}
