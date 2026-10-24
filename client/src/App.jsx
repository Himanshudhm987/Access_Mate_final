import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen, ScanText, Upload, Camera, Volume2, Save, Settings, Shield,
  Heart, Menu, X, Play, Pause, Square, RotateCcw, Copy, Download,
  Check, ChevronRight, FileText, Sparkles, AlertCircle, Trash2, Edit3,
  Search, Users, Activity, Sliders, RefreshCw, ZoomIn, Eye, ArrowUpRight,
  Languages, Bot, Zap, Flame, Wind, Mic, MicOff, History, FolderOpen
} from 'lucide-react';

import ChakraBackground from './components/ChakraBackground.jsx';
import AuthModal from './components/AuthModal.jsx';
import UserManagement from './components/UserManagement.jsx';
import AuditLogsViewer from './components/AuditLogsViewer.jsx';
import SystemHealth from './components/SystemHealth.jsx';
import TranslatorTool from './components/TranslatorTool.jsx';
import AiHumanAssistant from './components/AiHumanAssistant.jsx';
import VoiceAssistantWidget from './components/VoiceAssistantWidget.jsx';
import { VoiceCommander } from './utils/voiceCommander.js';
import {
  ShinobiHeadbandPlate,
  NinjaRankBadge,
  RasenganChakraSphere,
  JutsuPoofOverlay
} from './components/ShinobiAnimation.jsx';
import {
  preprocessImage,
  renderPdfPageToCanvas,
  performOcr,
  cleanupOcrWorker
} from './utils/ocrEngine.js';

const SETTINGS_KEY = 'accessmate-settings-v2';

const readStorage = (key, fallback) => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  // Session & User
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [showSignoutPoof, setShowSignoutPoof] = useState(false);

  // Navigation: 'home' | 'reader' | 'ai' | 'translator' | 'saved' | 'users' | 'audit' | 'system' | 'settings'
  const [page, setPage] = useState('home');
  const [readerTab, setReaderTab] = useState('upload'); // 'upload' | 'camera'
  const [mobileMenu, setMobileMenu] = useState(false);

  // Settings
  const [settings, setSettings] = useState(() =>
    readStorage(SETTINGS_KEY, {
      theme: 'dark', // 'dark' | 'light' | 'contrast'
      font: 100,
      lang: 'eng+hin',
      particles: true,
      autoSpeak: false
    })
  );

  // Notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // OCR & Document Reader State
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPdf, setIsPdf] = useState(false);
  const [pdfBuffer, setPdfBuffer] = useState(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(1);

  // Preprocessing controls
  const [preprocessOpts, setPreprocessOpts] = useState({
    grayscale: true,
    contrast: 20,
    binarize: false,
    sharpen: true,
    rotation: 0
  });

  const [ocrResult, setOcrResult] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);

  // Speech Synthesizer State
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);

  // Saved Documents State
  const [documents, setDocuments] = useState([]);
  const [docSearch, setDocSearch] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [editDocName, setEditDocName] = useState('');

  // Voice Command & Recent Image State
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [lastImageRecord, setLastImageRecord] = useState(() => {
    try {
      const saved = localStorage.getItem('accessmate-last-image');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const voiceCommanderRef = useRef(null);

  // Helper to convert DataURL to Blob
  const dataURItoBlob = (dataURI) => {
    try {
      const parts = dataURI.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], { type: mimeString });
    } catch {
      return null;
    }
  };

  // Refs
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const imgRef = useRef(null);
  const toastTimerRef = useRef(null);

  // Central API Client with credentials & CSRF
  const api = async (path, options = {}) => {
    const match = document.cookie.match(/accessmate_csrf=([^;]+)/);
    const csrfToken = match ? match[1] : '';

    const headers = {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...(options.headers || {})
    };

    let response;
    try {
      response = await fetch('/api' + path, {
        credentials: 'include',
        ...options,
        headers
      });
    } catch {
      throw new Error('Could not connect to AccessMate server. Please ensure the backend is running.');
    }

    let data = null;
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      const text = await response.text();
      data = text ? { error: text } : null;
    }

    if (!response.ok) {
      throw new Error(data?.error || `Request failed with status ${response.status}`);
    }

    return data;
  };

  const notify = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, message: '', type: 'info' });
    }, 4500);
  };

  const notifyError = (msg) => {
    notify(msg, 'error');
  };

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark', 'theme-contrast', 'dark', 'light');
    if (settings.theme === 'light') {
      root.classList.add('theme-light', 'light');
      document.body.style.backgroundColor = '#F8FAFC';
      document.body.style.color = '#0F172A';
    } else if (settings.theme === 'contrast') {
      root.classList.add('theme-contrast', 'dark');
      document.body.style.backgroundColor = '#000000';
      document.body.style.color = '#FFFFFF';
    } else {
      root.classList.add('theme-dark', 'dark');
      document.body.style.backgroundColor = '#090D16';
      document.body.style.color = '#F1F5F9';
    }
  }, [settings.theme]);

  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, []);

  const fetchDocuments = async () => {
    if (!user) return;
    setDocLoading(true);
    try {
      const q = docSearch ? `?search=${encodeURIComponent(docSearch)}` : '';
      const data = await api(`/documents${q}`);
      setDocuments(data.documents || []);
    } catch (err) {
      notifyError(err.message);
    } finally {
      setDocLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDocuments();
    } else {
      setDocuments([]);
    }
  }, [user, docSearch]);

  useEffect(() => {
    const loadVoices = () => {
      if ('speechSynthesis' in window) {
        const vList = window.speechSynthesis.getVoices() || [];
        setVoices(vList);
        const defaultV = vList.find((v) => v.lang.includes('hi') || v.lang.includes('en-IN'));
        if (defaultV && !selectedVoice) setSelectedVoice(defaultV.voiceURI);
      }
    };

    loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      stopSpeech();
      cleanupOcrWorker();
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  // Camera handling
  const startCamera = async () => {
    stopSpeech();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      streamRef.current = stream;
      setCameraActive(true);
      setReaderTab('camera');
      notify('Camera connected. Position your document clearly in the viewfinder.');
    } catch {
      notifyError('Camera access denied or unsupported. Please use image upload.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, readerTab]);

  const captureFrame = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      notifyError('Camera stream not ready.');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        const captureFile = new File([blob], `camera-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
        handleSelectFile(captureFile);
        stopCamera();
        setReaderTab('upload');
      }
    }, 'image/jpeg', 0.95);
  };

  // File selection
  const handleSelectFile = async (selectedFile) => {
    if (!selectedFile) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(selectedFile.type)) {
      notifyError('Please choose a valid JPG, PNG, WEBP, or PDF file.');
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      notifyError('File exceeds 25 MB limit.');
      return;
    }

    stopSpeech();
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selectedFile);
    setOcrResult('');
    setOcrConfidence(0);
    setOcrProgress(0);

    if (selectedFile.type === 'application/pdf') {
      setIsPdf(true);
      setPdfPage(1);
      const buffer = await selectedFile.arrayBuffer();
      setPdfBuffer(buffer);

      try {
        const { canvas, numPages } = await renderPdfPageToCanvas(buffer, 1);
        setPdfTotalPages(numPages);
        setPreviewUrl(canvas.toDataURL('image/png'));
        notify(`Loaded PDF (${numPages} page${numPages > 1 ? 's' : ''}). Page 1 ready for OCR.`);
      } catch (err) {
        notifyError(err.message);
      }
    } else {
      setIsPdf(false);
      setPdfBuffer(null);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      notify(`Loaded ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(0)} KB).`);

      // Store in lastImageRecord for voice recall
      const reader = new FileReader();
      reader.onload = (e) => {
        const record = {
          name: selectedFile.name,
          type: selectedFile.type,
          dataUrl: e.target.result,
          timestamp: Date.now()
        };
        setLastImageRecord(record);
        try {
          localStorage.setItem('accessmate-last-image', JSON.stringify(record));
        } catch {}
      };
      reader.readAsDataURL(selectedFile);
    }

    setPage('reader');
  };

  // Voice Command Handlers
  const handleVoiceOpenFile = () => {
    setPage('reader');
    setReaderTab('upload');
    if (fileInputRef.current) {
      try {
        fileInputRef.current.click();
      } catch {}
    }
    setTimeout(() => {
      try {
        fileInputRef.current?.click();
      } catch {}
    }, 60);
  };

  const handlePickLastImage = () => {
    let record = lastImageRecord;
    if (!record) {
      try {
        const saved = localStorage.getItem('accessmate-last-image');
        if (saved) record = JSON.parse(saved);
      } catch {}
    }

    if (record?.dataUrl) {
      try {
        const blob = dataURItoBlob(record.dataUrl);
        if (blob) {
          const restoredFile = new File([blob], record.name || 'last-image.jpg', {
            type: record.type || 'image/jpeg'
          });
          setFile(restoredFile);
          setPreviewUrl(record.dataUrl);
          setIsPdf(false);
          setPdfBuffer(null);
          setOcrResult('');
          setPage('reader');
          setReaderTab('upload');
          notify(`Restored last image: "${record.name}"`);
          return;
        }
      } catch (err) {
        console.warn('Error restoring image:', err);
      }
    }

    if (documents && documents.length > 0) {
      const latest = documents[0];
      setOcrResult(latest?.text || '');
      setPage('reader');
      notify(`Loaded latest saved text: "${latest?.name || 'Document'}"`);
      return;
    }

    notifyError('No recent image found. Say "Open file" to select one from your folder.');
  };

  // PDF page navigation
  const handlePdfPageChange = async (newPage) => {
    if (!pdfBuffer || newPage < 1 || newPage > pdfTotalPages) return;
    setPdfPage(newPage);
    try {
      const { canvas } = await renderPdfPageToCanvas(pdfBuffer, newPage);
      setPreviewUrl(canvas.toDataURL('image/png'));
      notify(`Rendered page ${newPage} of ${pdfTotalPages}.`);
    } catch (err) {
      notifyError(err?.message || 'Failed to render PDF page.');
    }
  };

  // Run OCR
  const handleExtractText = async () => {
    if (!previewUrl || ocrBusy) return;

    setOcrBusy(true);
    setOcrProgress(5);
    setOcrStatusText('Applying chakra preprocessing…');

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = previewUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image preview into OCR pipeline.'));
      });

      const processedCanvas = await preprocessImage(img, preprocessOpts);

      setOcrStatusText('Recognizing Hindi & English characters…');
      const ocrData = await performOcr(
        processedCanvas,
        settings.lang,
        ({ progress, status }) => {
          setOcrProgress(progress || 0);
          setOcrStatusText(status || 'Processing…');
        }
      );

      const cleanText = (ocrData?.text || '').trim();
      const score = typeof ocrData?.confidence === 'number' ? ocrData.confidence : 0;

      setOcrResult(cleanText);
      setOcrConfidence(score);

      if (cleanText) {
        notify(`OCR Complete! Extracted text with ${score}% confidence score.`);
        if (settings.autoSpeak) {
          setTimeout(handleSpeak, 500);
        }
      } else {
        notify('No text detected. Try adjusting contrast or lighting.', 'info');
      }
    } catch (err) {
      const errMsg = (err && (err.message || (typeof err === 'string' ? err : null))) || 'Recognition failed. Please try a clearer image.';
      notifyError(`OCR failed: ${errMsg}`);
    } finally {
      setOcrBusy(false);
      setOcrProgress(100);
    }
  };

  // Speech Synthesizer
  const handleSpeak = () => {
    const textToSpeak = (ocrResult || '').trim();
    if (!textToSpeak) {
      notifyError('No text to read aloud.');
      return;
    }
    if (!('speechSynthesis' in window)) {
      notifyError('Speech synthesis not supported in this browser.');
      return;
    }

    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = rate;
    utterance.volume = volume;
    utterance.pitch = pitch;

    const hasHindi = /[\u0900-\u097F]/.test(textToSpeak);
    utterance.lang = hasHindi ? 'hi-IN' : 'en-US';

    const chosenVoice = voices.find((v) => v.voiceURI === selectedVoice);
    if (chosenVoice) utterance.voice = chosenVoice;

    utterance.onend = () => {
      setSpeaking(false);
      setPaused(false);
    };

    utterance.onerror = (e) => {
      setSpeaking(false);
      setPaused(false);
      if (e.error !== 'canceled') notifyError('Speech playback interrupted.');
    };

    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
    setPaused(false);
  };

  const handlePauseSpeech = () => {
    window.speechSynthesis.pause();
    setPaused(true);
  };

  const handleResumeSpeech = () => {
    window.speechSynthesis.resume();
    setPaused(false);
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setPaused(false);
  };

  // Save document to backend
  const handleSaveDocument = async (textToSave = ocrResult, nameToSave = null) => {
    if (!user) {
      setAuthOpen(true);
      notify('Please sign in to save documents to your account.', 'info');
      return;
    }

    if (!textToSave.trim()) {
      notifyError('Nothing to save. Extract or enter some text first.');
      return;
    }

    try {
      let savedDoc;
      if (file && textToSave === ocrResult) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('text', textToSave);
        formData.append('confidence', ocrConfidence);
        formData.append('language', settings.lang);

        const data = await api('/documents/upload', {
          method: 'POST',
          body: formData
        });
        savedDoc = data.document;
      } else {
        const data = await api('/documents', {
          method: 'POST',
          body: JSON.stringify({
            name: nameToSave || file?.name || `Document ${new Date().toLocaleDateString()}`,
            text: textToSave,
            confidence: ocrConfidence,
            language: settings.lang
          })
        });
        savedDoc = data.document;
      }

      setDocuments((prev) => [savedDoc, ...prev]);
      notify('Document securely saved to your account!');
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleUpdateDocument = async (docId, newText, newName) => {
    try {
      const data = await api(`/documents/${docId}`, {
        method: 'PUT',
        body: JSON.stringify({ text: newText, name: newName })
      });
      setDocuments((prev) => prev.map((d) => (d.id === docId ? data.document : d)));
      notify('Document updated successfully.');
      setEditingDocId(null);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleDeleteDocument = async (docId, name) => {
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;

    try {
      await api(`/documents/${docId}`, { method: 'DELETE' });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      notify(`Deleted "${name}".`);
    } catch (err) {
      notifyError(err.message);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(ocrResult || '');
      notify('Extracted text copied to clipboard!');
    } catch {
      notifyError('Clipboard unavailable. Please select text manually.');
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([ocrResult || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessmate-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Downloaded text document.');
  };

  const handleLogout = async () => {
    setShowSignoutPoof(true);
    setTimeout(async () => {
      try {
        await api('/auth/logout', { method: 'POST' });
        setUser(null);
        setDocuments([]);
        setPage('home');
        setShowSignoutPoof(false);
        notify('Shinobi Session Terminated. Signed out.');
      } catch (err) {
        setShowSignoutPoof(false);
        notifyError(err.message);
      }
    }, 1100);
  };

  const insertHindiKey = (char) => {
    setOcrResult((prev) => prev + char);
  };

  // Dynamic voice handlers ref — always points to the latest state without tearing down recognition
  const voiceHandlersRef = useRef({});
  voiceHandlersRef.current = {
    onStateChange: (active) => setVoiceListening(active),
    onTranscript: (phrase) => setVoiceTranscript(phrase),
    onOpenFile: () => handleVoiceOpenFile(),
    onPickLastImage: () => handlePickLastImage(),
    onExtractText: () => handleExtractText(),
    onSpeak: () => handleSpeak(),
    onPause: () => handlePauseSpeech(),
    onResume: () => handleResumeSpeech(),
    onStopSpeech: () => stopSpeech(),
    onSaveDocument: () => handleSaveDocument(),
    onCopyText: () => handleCopyText(),
    onClear: () => {
      setOcrResult('');
      setOcrConfidence(0);
      notify('Document cleared.');
    },
    onSetTheme: (newTheme) => setSettings((s) => ({ ...s, theme: newTheme })),
    onTranslate: () => setPage('translator'),
    onNavigate: (targetPage) => setPage(targetPage),
    onError: (msg) => notifyError(msg)
  };

  // Mount Voice Commander once with non-teardown dynamic handler lookup
  useEffect(() => {
    const commander = new VoiceCommander(() => voiceHandlersRef.current);
    voiceCommanderRef.current = commander;

    return () => {
      commander.stop();
    };
  }, []);

  const themeClass =
    settings.theme === 'light'
      ? 'theme-light'
      : settings.theme === 'contrast'
      ? 'theme-contrast'
      : 'theme-dark';

  return (
    <div
      className={`min-h-screen flex flex-col relative transition-colors duration-300 ${themeClass}`}
      style={{ fontSize: `${settings.font}%` }}
    >
      {/* Subtle particle background - only active in dark mode */}
      <ChakraBackground enabled={settings.particles && settings.theme === 'dark'} />

      {/* Substitution Jutsu Poof Overlay on Logout */}
      <JutsuPoofOverlay active={showSignoutPoof} text="Substitution Jutsu! Signed Out" />

      {/* Skip to Main Content Link for A11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-electric focus:text-black focus:font-bold focus:rounded-xl"
      >
        Skip to main content
      </a>

      {/* Top Notification Toast */}
      {toast.show && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl jutsu-smoke-entrance border ${
            toast.type === 'error'
              ? 'bg-red-950/90 border-red-500/60 text-red-200 shadow-red-900/30'
              : toast.type === 'success'
              ? 'bg-navy-900/90 border-emerald-500/60 text-emerald-200 shadow-emerald-900/30'
              : 'bg-navy-900/90 border-electric/60 text-electric shadow-cyan-900/30'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <Check size={18} />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Global Header */}
      <header className="sticky top-0 z-40 bg-obsidian-950/90 border-b border-navy-700/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Brand Logo with Naruto Shinobi Headband Badge */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setPage('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex items-center gap-2.5 text-xl font-black tracking-tight group"
              aria-label="AccessMate Home"
            >
              <span className="p-2 rounded-xl bg-gradient-to-br from-electric via-sky-400 to-flame text-obsidian-950 shadow-md group-hover:scale-105 transition chakra-glow">
                <BookOpen size={20} />
              </span>
              <span className="text-white">
                Access<span className="text-electric">Mate</span>
              </span>
            </button>
            <ShinobiHeadbandPlate text="SHINOBI OCR" className="hidden sm:inline-flex" />
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="Main Navigation" className="hidden lg:flex items-center gap-5 text-xs font-semibold text-slate-300">
            <button
              onClick={() => setPage('home')}
              className={`hover:text-electric transition ${page === 'home' ? 'text-electric font-bold' : ''}`}
            >
              Home
            </button>
            <button
              onClick={() => { setPage('reader'); setReaderTab('upload'); }}
              className={`hover:text-electric transition flex items-center gap-1.5 ${
                page === 'reader' ? 'text-electric font-bold' : ''
              }`}
            >
              <ScanText size={14} /> OCR Studio
            </button>
            <button
              onClick={() => setPage('translator')}
              className={`hover:text-electric transition flex items-center gap-1.5 ${
                page === 'translator' ? 'text-electric font-bold' : ''
              }`}
            >
              <Languages size={14} /> Translator
            </button>
            <button
              onClick={() => setPage('ai')}
              className={`hover:text-flame transition flex items-center gap-1.5 ${
                page === 'ai' ? 'text-flame font-bold' : ''
              }`}
            >
              <Bot size={14} /> AI Explainer
            </button>
            <button
              onClick={() => setPage('saved')}
              className={`hover:text-electric transition ${page === 'saved' ? 'text-electric font-bold' : ''}`}
            >
              Saved Docs {documents.length > 0 && `(${documents.length})`}
            </button>

            {/* Role-based RBAC Tabs */}
            {['super_admin', 'admin'].includes(user?.role) && (
              <button
                onClick={() => setPage('users')}
                className={`hover:text-electric transition flex items-center gap-1.5 ${
                  page === 'users' ? 'text-electric font-bold' : ''
                }`}
              >
                <Users size={14} /> User Directory
              </button>
            )}

            {user?.role === 'super_admin' && (
              <button
                onClick={() => setPage('audit')}
                className={`hover:text-electric transition flex items-center gap-1.5 ${
                  page === 'audit' ? 'text-electric font-bold' : ''
                }`}
              >
                <Shield size={14} /> Audit Logs
              </button>
            )}

            {['super_admin', 'admin'].includes(user?.role) && (
              <button
                onClick={() => setPage('system')}
                className={`hover:text-electric transition flex items-center gap-1.5 ${
                  page === 'system' ? 'text-electric font-bold' : ''
                }`}
              >
                <Activity size={14} /> Telemetry
              </button>
            )}

            <button
              onClick={() => setPage('settings')}
              className={`hover:text-electric transition flex items-center gap-1 ${
                page === 'settings' ? 'text-electric font-bold' : ''
              }`}
            >
              <Settings size={14} /> A11y
            </button>
          </nav>

          {/* User Profile / Auth Action */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Quick Voice Command Toggle in Header */}
            <button
              onClick={() => voiceCommanderRef.current?.toggle()}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                voiceListening
                  ? 'bg-sky-400 text-obsidian-950 shadow-md animate-pulse ring-2 ring-sky-300'
                  : 'btn-secondary text-slate-200 hover:text-white'
              }`}
              title={voiceListening ? 'Voice command listening active. Click to stop' : 'Click to start voice command'}
              aria-label="Toggle voice command"
            >
              <Mic size={14} className={voiceListening ? 'text-obsidian-950 animate-bounce' : 'text-sky-400'} />
              <span className="hidden md:inline">{voiceListening ? 'Listening…' : 'Voice Control'}</span>
            </button>

            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-white leading-tight">{user.name}</span>
                  <NinjaRankBadge role={user.role} className="mt-0.5" />
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  title="Substitution Jutsu Sign Out"
                >
                  <Wind size={13} className="text-slate-400" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <Zap size={14} /> Sign In / Sign Up
              </button>
            )}

            <button
              onClick={() => setMobileMenu(!mobileMenu)}
              className="lg:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-navy-800"
              aria-label="Toggle Navigation"
              aria-expanded={mobileMenu}
            >
              {mobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenu && (
          <nav aria-label="Mobile Menu" className="lg:hidden border-t border-navy-700 bg-obsidian-950 px-4 py-4 space-y-2">
            <button
              onClick={() => {
                setMobileMenu(false);
                voiceCommanderRef.current?.toggle();
              }}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                voiceListening ? 'bg-sky-400 text-obsidian-950 ring-2 ring-sky-300' : 'bg-navy-900 border border-navy-700 text-sky-400'
              }`}
            >
              <Mic size={15} />
              {voiceListening ? 'Listening Active (Tap to Stop)' : 'Voice Command Control (Tap to Speak)'}
            </button>
            {[
              ['Home', 'home'],
              ['OCR Studio', 'reader'],
              ['Bilingual Translator', 'translator'],
              ['AI Explainer (Tell Human)', 'ai'],
              ['Saved Documents', 'saved'],
              ...(['super_admin', 'admin'].includes(user?.role) ? [['User Directory', 'users']] : []),
              ...(user?.role === 'super_admin' ? [['Security Logs', 'audit']] : []),
              ...(['super_admin', 'admin'].includes(user?.role) ? [['System Telemetry', 'system']] : []),
              ['Accessibility Settings', 'settings']
            ].map(([label, target]) => (
              <button
                key={target}
                onClick={() => { setPage(target); setMobileMenu(false); }}
                className="w-full text-left p-2 rounded-lg text-sm font-semibold hover:bg-navy-800 text-slate-200"
              >
                {label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Main Container */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 relative z-10">

        {/* 1. HOME LANDING PAGE */}
        {page === 'home' && (
          <div className="space-y-16">
            <section className="grid lg:grid-cols-2 gap-12 items-center pt-8 pb-12">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold bg-electric/15 text-electric border border-electric/30 chakra-glow">
                  <Sparkles size={14} /> High Precision Hindi & English OCR • Shinobi Edition
                </div>

                <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
                  Awaken Every Word with{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-electric via-sky-300 to-flame">
                    Precision OCR.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
                  Transform printed books, scanned PDFs, prescription labels, and letters into crystal-clear text. Powered by dual Hindi Devanagari and English recognition, instant translation, and natural human explainer AI.
                </p>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => { setPage('reader'); setReaderTab('upload'); }}
                    className="btn-primary px-6 py-3 text-sm flex items-center gap-2"
                  >
                    <ScanText size={18} />
                    Open OCR Studio
                  </button>

                  <button
                    onClick={() => { setPage('reader'); startCamera(); }}
                    className="btn-flame px-6 py-3 text-sm flex items-center gap-2"
                  >
                    <Camera size={18} />
                    Live Camera Scanner
                  </button>

                  <button
                    onClick={() => setPage('translator')}
                    className="btn-secondary px-5 py-3 text-sm flex items-center gap-2"
                  >
                    <Languages size={18} />
                    Translator
                  </button>
                </div>

                <div className="flex items-center gap-4 pt-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <Shield size={14} /> Zero Data Leaks
                  </span>
                  <span>•</span>
                  <span>Tesseract.js Engine</span>
                  <span>•</span>
                  <span>WCAG 2.1 AAA Compliant</span>
                </div>
              </div>

              {/* Anime Visual Hero Card with Rasengan Swirl */}
              <div className="relative">
                <div className="panel border-navy-600/90 shadow-2xl relative overflow-hidden p-8 space-y-6">
                  {/* Floating Rasengan Sphere in top-right */}
                  <div className="absolute -top-4 -right-4">
                    <RasenganChakraSphere size={90} active={true} />
                  </div>

                  <div className="flex items-center justify-between border-b border-navy-700 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-flame/15 text-flame kyuubi-glow">
                        <FileText size={22} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">Bilingual Document Reader</div>
                        <div className="text-xs text-slate-400">English + Hindi OCR • Shinobi Chakra Mode</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-navy-900 border border-navy-700/80 font-mono text-xs text-slate-300 space-y-2">
                    <p className="text-electric font-semibold">नमस्ते / Welcome to AccessMate.</p>
                    <p className="text-slate-300">सभी के लिए सुलभ तकनीक — Technology for Universal Inclusion.</p>
                    <p className="text-slate-400 text-[11px]">Instant text-to-speech with natural cadence and AI translation.</p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-electric">
                      <Volume2 size={16} />
                      <span>Natural Indian English & Hindi Voices</span>
                    </div>
                    <div className="flex items-center gap-1 h-5">
                      <span className="wave-bar h-2" style={{ animationDelay: '0.1s' }} />
                      <span className="wave-bar h-4" style={{ animationDelay: '0.3s' }} />
                      <span className="wave-bar h-3" style={{ animationDelay: '0.2s' }} />
                      <span className="wave-bar h-5" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 2. DOCUMENT READER & OCR STUDIO */}
        {page === 'reader' && (
          <div className="space-y-6">
            <div className="panel flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
                  <ScanText className="text-electric" /> OCR Studio & Document Reader
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Upload an image, scan with live camera, or load a PDF to extract bilingual text.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setReaderTab('upload'); stopCamera(); }}
                  className={`btn text-xs ${readerTab === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                >
                  <Upload size={14} /> Upload File
                </button>
                <button
                  onClick={startCamera}
                  className={`btn text-xs ${readerTab === 'camera' ? 'btn-flame' : 'btn-secondary'}`}
                >
                  <Camera size={14} /> Live Camera Read
                </button>
              </div>
            </div>

            {/* Input Zone: Drag & Drop OR Live Camera Viewfinder */}
            {readerTab === 'camera' ? (
              <div className="panel space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-black max-h-96 flex items-center justify-center border-2 border-electric/60">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-auto max-h-96 object-contain"
                    aria-label="Live Camera Scanner Feed"
                  />
                  {cameraActive && (
                    <div className="absolute inset-0 border-2 border-dashed border-electric/60 pointer-events-none m-6 rounded-xl flex items-center justify-center">
                      <div className="text-center p-2 rounded-xl bg-obsidian-950/70 text-electric text-xs font-mono">
                        Center document in frame & click "Capture & Read"
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <button onClick={captureFrame} className="btn-primary text-xs flex items-center gap-2">
                    <Camera size={15} /> Capture & Read Document
                  </button>
                  <button onClick={stopCamera} className="btn-secondary text-xs">
                    Close Camera
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleSelectFile(e.dataTransfer.files[0]);
                }}
                className="panel border-2 border-dashed border-navy-600 hover:border-electric/60 transition p-8 text-center cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleSelectFile(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
                <div className="p-4 rounded-2xl bg-electric/10 text-electric w-fit mx-auto mb-3 group-hover:scale-110 transition chakra-glow">
                  <Upload size={32} />
                </div>
                <p className="text-sm font-bold text-white mb-1">
                  Drag and drop a document here, or click to browse
                </p>
                <p className="text-xs text-slate-400">
                  Supports JPG, PNG, WEBP, and multi-page PDF documents (up to 25 MB)
                </p>
              </div>
            )}

            {/* Preprocessing & Language Controls Bar */}
            <div className="panel grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1" htmlFor="ocr-lang">
                  OCR Language
                </label>
                <select
                  id="ocr-lang"
                  value={settings.lang}
                  onChange={(e) => setSettings({ ...settings, lang: e.target.value })}
                  className="w-full text-xs py-2 px-3 bg-navy-900 border border-navy-700 rounded-xl text-white focus:border-electric"
                >
                  <option value="eng+hin">English + Hindi (Mixed)</option>
                  <option value="hin">Hindi (Devanagari Only)</option>
                  <option value="eng">English (Latin Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Contrast: {preprocessOpts.contrast}
                </label>
                <input
                  type="range"
                  min="-30"
                  max="60"
                  step="5"
                  value={preprocessOpts.contrast}
                  onChange={(e) => setPreprocessOpts({ ...preprocessOpts, contrast: Number(e.target.value) })}
                  className="w-full accent-electric"
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="opt-grayscale"
                  checked={preprocessOpts.grayscale}
                  onChange={(e) => setPreprocessOpts({ ...preprocessOpts, grayscale: e.target.checked })}
                  className="rounded bg-navy-900 border-navy-700 text-electric focus:ring-0"
                />
                <label htmlFor="opt-grayscale" className="text-xs font-semibold text-slate-300 cursor-pointer">
                  Grayscale Filter
                </label>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="opt-sharpen"
                  checked={preprocessOpts.sharpen}
                  onChange={(e) => setPreprocessOpts({ ...preprocessOpts, sharpen: e.target.checked })}
                  className="rounded bg-navy-900 border-navy-700 text-electric focus:ring-0"
                />
                <label htmlFor="opt-sharpen" className="text-xs font-semibold text-slate-300 cursor-pointer">
                  Sharpen Matras
                </label>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="opt-binarize"
                  checked={preprocessOpts.binarize}
                  onChange={(e) => setPreprocessOpts({ ...preprocessOpts, binarize: e.target.checked })}
                  className="rounded bg-navy-900 border-navy-700 text-electric focus:ring-0"
                />
                <label htmlFor="opt-binarize" className="text-xs font-semibold text-slate-300 cursor-pointer">
                  Adaptive Threshold
                </label>
              </div>
            </div>

            {/* Split View: Document Preview & Extracted Text Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Left Column: Document Preview */}
              <div className="panel space-y-4">
                <div className="flex justify-between items-center border-b border-navy-700 pb-3">
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Eye size={16} className="text-electric" /> Document Preview
                  </h2>

                  {isPdf && pdfTotalPages > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        disabled={pdfPage <= 1}
                        onClick={() => handlePdfPageChange(pdfPage - 1)}
                        className="px-2 py-1 rounded bg-navy-900 border border-navy-700 disabled:opacity-30"
                      >
                        Prev
                      </button>
                      <span className="font-mono text-slate-300">
                        Page {pdfPage} / {pdfTotalPages}
                      </span>
                      <button
                        disabled={pdfPage >= pdfTotalPages}
                        onClick={() => handlePdfPageChange(pdfPage + 1)}
                        className="px-2 py-1 rounded bg-navy-900 border border-navy-700 disabled:opacity-30"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative min-h-[320px] max-h-[460px] rounded-xl overflow-hidden bg-navy-950 flex items-center justify-center border border-navy-700/80">
                  {previewUrl ? (
                    <>
                      <img
                        ref={imgRef}
                        src={previewUrl}
                        alt="Document to be recognized"
                        className="w-full h-full object-contain max-h-[450px]"
                      />
                      {ocrBusy && <div className="scan-laser" />}
                    </>
                  ) : (
                    <div className="text-center p-8 text-slate-500 space-y-2">
                      <FileText size={48} className="mx-auto opacity-40" />
                      <p className="text-xs">No image selected. Upload or capture a document above.</p>
                    </div>
                  )}
                </div>

                <button
                  disabled={!previewUrl || ocrBusy}
                  onClick={handleExtractText}
                  className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
                >
                  <ScanText size={18} />
                  {ocrBusy ? 'Recognizing Text…' : 'Extract Text (Hindi + English)'}
                </button>

                {ocrBusy && (
                  <div className="space-y-1.5 anime-entrance">
                    <div className="h-2 w-full bg-navy-900 rounded-full overflow-hidden border border-navy-700">
                      <div
                        className="h-full bg-gradient-to-r from-electric to-sky-400 transition-all duration-300"
                        style={{ width: `${ocrProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{ocrStatusText}</span>
                      <span className="font-mono">{ocrProgress}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Editable Extracted Text */}
              <div className="panel space-y-4">
                <div className="flex justify-between items-center border-b border-navy-700 pb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Edit3 size={16} className="text-flame" /> Extracted Text
                    </h2>
                    {ocrConfidence > 0 && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          ocrConfidence >= 80
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : ocrConfidence >= 60
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {ocrConfidence}% Confidence
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    {(ocrResult || '').length} chars · {(ocrResult || '').trim() ? (ocrResult || '').trim().split(/\s+/).length : 0} words
                  </span>
                </div>

                <label htmlFor="ocr-text-result" className="sr-only">
                  Editable extracted document text
                </label>
                <textarea
                  id="ocr-text-result"
                  value={ocrResult || ''}
                  onChange={(e) => setOcrResult(e.target.value)}
                  placeholder="Recognized text will appear here. You can type, edit, or adjust directly."
                  className="w-full min-h-[280px] p-4 text-sm bg-navy-950 border border-navy-700 rounded-xl text-white placeholder-slate-600 focus:border-electric resize-y font-sans leading-relaxed"
                />

                {/* Virtual Hindi Helper Bar */}
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-semibold">Devanagari Quick Inserts:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['्', 'ा', 'ि', 'ी', 'ु', 'ू', 'े', 'ै', 'ो', 'ौ', 'ं', 'ः', 'ँ', 'ॐ', '।'].map((char) => (
                      <button
                        key={char}
                        type="button"
                        onClick={() => insertHindiKey(char)}
                        className="px-2.5 py-1 text-xs rounded bg-navy-900 hover:bg-navy-700 border border-navy-700 text-electric font-bold transition"
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Action Navigation Buttons */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    disabled={!(ocrResult || '').trim()}
                    onClick={() => setPage('translator')}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Languages size={14} className="text-electric" /> Translate Text
                  </button>
                  <button
                    disabled={!(ocrResult || '').trim()}
                    onClick={() => setPage('ai')}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <Bot size={14} className="text-flame" /> Ask AI Explainer
                  </button>
                  <button
                    disabled={!(ocrResult || '').trim()}
                    onClick={handleCopyText}
                    className="btn-secondary text-xs"
                  >
                    <Copy size={14} /> Copy
                  </button>
                  <button
                    disabled={!(ocrResult || '').trim()}
                    onClick={handleDownloadTxt}
                    className="btn-secondary text-xs"
                  >
                    <Download size={14} /> Download TXT
                  </button>
                  <button
                    disabled={!(ocrResult || '').trim()}
                    onClick={() => handleSaveDocument(ocrResult || '')}
                    className="btn-flame text-xs"
                  >
                    <Save size={14} /> Save Document
                  </button>
                  <button
                    onClick={() => {
                      setOcrResult('');
                      setOcrConfidence(0);
                    }}
                    className="btn-ghost text-xs text-slate-400"
                  >
                    <RotateCcw size={14} /> Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Speech Playback Studio */}
            <div className="panel space-y-4 border-navy-600">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-navy-700 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-electric/15 text-electric">
                    <Volume2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Text-to-Speech Playback Studio
                    </h3>
                    <p className="text-xs text-slate-400">
                      Listen to Hindi or English text aloud with speed and voice customization.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!speaking ? (
                    <button
                      disabled={!(ocrResult || '').trim()}
                      onClick={handleSpeak}
                      className="btn-primary text-xs"
                    >
                      <Play size={14} /> Read Aloud
                    </button>
                  ) : (
                    <>
                      {paused ? (
                        <button onClick={handleResumeSpeech} className="btn-primary text-xs">
                          <Play size={14} /> Resume
                        </button>
                      ) : (
                        <button onClick={handlePauseSpeech} className="btn-secondary text-xs">
                          <Pause size={14} /> Pause
                        </button>
                      )}
                      <button onClick={stopSpeech} className="btn-danger text-xs">
                        <Square size={14} /> Stop
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Select Speech Voice
                  </label>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full text-xs py-2 px-3 bg-navy-900 border border-navy-700 rounded-xl text-white focus:border-electric"
                  >
                    <option value="">Browser Default Voice</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Reading Speed: {rate.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    className="w-full accent-electric"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Pitch: {pitch.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={pitch}
                    onChange={(e) => setPitch(Number(e.target.value))}
                    className="w-full accent-electric"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. BILINGUAL TRANSLATOR STUDIO */}
        {page === 'translator' && (
          <div className="space-y-6">
            <TranslatorTool
              initialText={ocrResult}
              onSaveTranslated={(translatedText, name) => handleSaveDocument(translatedText, name)}
              notify={notify}
              notifyError={notifyError}
            />
          </div>
        )}

        {/* 4. AI EXPLAINER ("TELL HUMAN") ASSISTANT */}
        {page === 'ai' && (
          <div className="space-y-6">
            <AiHumanAssistant
              documentText={ocrResult}
              notify={notify}
              notifyError={notifyError}
            />
          </div>
        )}

        {/* 5. SAVED DOCUMENTS MANAGER */}
        {page === 'saved' && (
          <div className="space-y-6">
            <div className="panel flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="text-electric" /> Saved Documents Directory
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Access, edit, search, and download your cloud OCR records ({documents.length} files).
                </p>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search documents…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-navy-900 border border-navy-700 rounded-xl text-white placeholder-slate-500 focus:border-electric"
                  />
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                </div>
                <button
                  onClick={fetchDocuments}
                  className="btn-secondary text-xs"
                  aria-label="Refresh Documents"
                >
                  <RefreshCw size={13} className={docLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {!user ? (
              <div className="panel text-center py-16 space-y-4">
                <Shield size={48} className="mx-auto text-electric opacity-60" />
                <h2 className="text-lg font-bold text-white">Sign In Required</h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Sign in or create an account to store and synchronize your extracted text and documents securely.
                </p>
                <button onClick={() => setAuthOpen(true)} className="btn-primary text-xs">
                  Sign In / Sign Up
                </button>
              </div>
            ) : !documents.length ? (
              <div className="panel text-center py-16 space-y-3">
                <FileText size={48} className="mx-auto text-slate-600" />
                <h2 className="text-lg font-bold text-white">No Saved Documents Yet</h2>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Extract text from an image or PDF in the OCR Studio and select "Save Document".
                </p>
                <button
                  onClick={() => { setPage('reader'); setReaderTab('upload'); }}
                  className="btn-primary text-xs"
                >
                  Go to OCR Studio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {documents.map((doc) => {
                  const isEditing = editingDocId === doc.id;

                  return (
                    <article
                      key={doc.id}
                      className="panel flex flex-col justify-between hover:border-electric/50 transition group"
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDocName}
                              onChange={(e) => setEditDocName(e.target.value)}
                              className="w-full text-xs font-bold bg-navy-900 border border-navy-600 rounded px-2 py-1 text-white"
                            />
                          ) : (
                            <h3 className="text-sm font-bold text-white group-hover:text-electric transition break-all">
                              {doc.name}
                            </h3>
                          )}

                          {doc.confidence > 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-navy-900 border border-navy-700 text-slate-300 shrink-0">
                              {Math.round(doc.confidence)}%
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-400 line-clamp-4 font-sans bg-navy-900/60 p-3 rounded-xl border border-navy-700/60 leading-relaxed">
                          {doc.text}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-navy-700/80 mt-4 flex items-center justify-between text-xs text-slate-400">
                        <span>{new Date(doc.date).toLocaleDateString()}</span>

                        <div className="flex items-center gap-1.5">
                          {isEditing ? (
                            <button
                              onClick={() => handleUpdateDocument(doc.id, doc.text, editDocName)}
                              className="btn-primary text-[11px] px-2.5 py-1"
                            >
                              Save
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setOcrResult(doc.text);
                                setOcrConfidence(doc.confidence || 0);
                                setPage('reader');
                                notify(`Loaded "${doc.name}" into OCR Studio.`);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-electric hover:bg-navy-700"
                              title="Open in OCR Studio"
                            >
                              <ArrowUpRight size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setEditingDocId(isEditing ? null : doc.id);
                              setEditDocName(doc.name);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-navy-700"
                            title="Edit document"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            onClick={() => handleDeleteDocument(doc.id, doc.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            title="Delete document"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 6. RBAC USER DIRECTORY (Super Admin & Admin Only) */}
        {page === 'users' && ['super_admin', 'admin'].includes(user?.role) && (
          <UserManagement
            currentUser={user}
            api={api}
            notify={notify}
            setErrorMsg={notifyError}
          />
        )}

        {/* 7. AUDIT LOGS CONSOLE (Super Admin Only) */}
        {page === 'audit' && user?.role === 'super_admin' && (
          <AuditLogsViewer api={api} setErrorMsg={notifyError} />
        )}

        {/* 8. SYSTEM HEALTH & TELEMETRY (Super Admin & Admin Only) */}
        {page === 'system' && ['super_admin', 'admin'].includes(user?.role) && (
          <SystemHealth api={api} setErrorMsg={notifyError} />
        )}

        {/* 9. ACCESSIBILITY SETTINGS PAGE */}
        {page === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="panel space-y-6">
              <h1 className="text-xl font-bold text-white flex items-center gap-2 border-b border-navy-700 pb-3">
                <Settings className="text-electric" /> Accessibility & Presentation Preferences
              </h1>

              {/* Interface Theme Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Interface Theme
                </label>
                <div className="grid grid-cols-3 gap-3 text-xs font-bold">
                  {[
                    ['dark', 'Dark Mode', 'border-navy-600 bg-navy-900 text-slate-100'],
                    ['light', 'Light Mode', 'border-slate-300 bg-white text-slate-900 shadow-sm'],
                    ['contrast', 'High Contrast', 'border-white bg-black text-yellow-300']
                  ].map(([themeVal, label, classes]) => (
                    <button
                      key={themeVal}
                      onClick={() => setSettings({ ...settings, theme: themeVal })}
                      className={`p-3 rounded-xl border text-center transition ${classes} ${
                        settings.theme === themeVal ? 'ring-2 ring-sky-400 font-black' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Scaling */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span>Display Font Scaling</span>
                  <span className="font-mono text-electric">{settings.font}%</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="150"
                  step="5"
                  value={settings.font}
                  onChange={(e) => setSettings({ ...settings, font: Number(e.target.value) })}
                  className="w-full accent-electric"
                />
              </div>

              {/* Particle Animation Switch */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-xs font-bold text-white">Chakra Background Energy Particles</div>
                  <div className="text-[11px] text-slate-400">Subtle floating ambient chakra particles</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.particles}
                  onChange={(e) => setSettings({ ...settings, particles: e.target.checked })}
                  className="rounded bg-navy-900 border-navy-700 text-electric focus:ring-0 w-4 h-4"
                />
              </div>

              {/* Auto-read text toggle */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <div className="text-xs font-bold text-white">Auto Read Aloud After Extraction</div>
                  <div className="text-[11px] text-slate-400">Automatically trigger speech synthesizer</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoSpeak}
                  onChange={(e) => setSettings({ ...settings, autoSpeak: e.target.checked })}
                  className="rounded bg-navy-900 border-navy-700 text-electric focus:ring-0 w-4 h-4"
                />
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Global Footer */}
      <footer className="border-t border-navy-700/80 bg-obsidian-950 py-8 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">AccessMate</span>
            <span>•</span>
            <span>Bilingual Assistive Reading & Shinobi AI Platform</span>
          </div>

          <div className="flex flex-wrap gap-4">
            <button onClick={() => setPage('home')} className="hover:text-white">Home</button>
            <button onClick={() => setPage('reader')} className="hover:text-white">OCR Studio</button>
            <button onClick={() => setPage('translator')} className="hover:text-white">Translator</button>
            <button onClick={() => setPage('ai')} className="hover:text-white">AI Explainer</button>
            <button onClick={() => setPage('saved')} className="hover:text-white">Saved Docs</button>
            <button onClick={() => setPage('settings')} className="hover:text-white">Accessibility</button>
          </div>

          <div className="text-slate-500 text-[11px]">
            WCAG 2.1 AAA Compliant • Shinobi Chakra UI
          </div>
        </div>
      </footer>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          fetchDocuments();
        }}
        api={api}
        notify={notify}
        setErrorMsg={notifyError}
      />

      {/* Interactive Voice Assistant Floating Widget */}
      <VoiceAssistantWidget
        isListening={voiceListening}
        onToggle={() => voiceCommanderRef.current?.toggle()}
        lastTranscript={voiceTranscript}
        onRunSampleCommand={(sampleCmd) => voiceCommanderRef.current?.matchAndExecute(sampleCmd)}
        supported={voiceCommanderRef.current?.supported ?? true}
      />
    </div>
  );
}
