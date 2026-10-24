import React, { useState } from 'react';
import { Mic, MicOff, Volume2, Sparkles, FolderOpen, History, Play, ScanText, X, HelpCircle, Save } from 'lucide-react';

export default function VoiceAssistantWidget({
  isListening,
  onToggle,
  lastTranscript,
  onRunSampleCommand,
  supported = true
}) {
  const [showDrawer, setShowDrawer] = useState(false);

  const commandSamples = [
    { label: 'Open File / Folder', cmd: 'open file', icon: FolderOpen },
    { label: 'Pick Last Image', cmd: 'pick up my last image', icon: History },
    { label: 'Extract Text', cmd: 'extract text', icon: ScanText },
    { label: 'Read Aloud', cmd: 'read aloud', icon: Play },
    { label: 'Save Document', cmd: 'save document', icon: Save },
    { label: 'Switch to Light Mode', cmd: 'light mode', icon: Sparkles }
  ];

  if (!supported) return null;

  return (
    <aside
      aria-label="AccessMate Voice Command Controller"
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 select-none"
    >
      {/* Voice status & transcript popover when active */}
      {isListening && (
        <div className="w-80 max-w-[calc(100vw-3rem)] p-4 rounded-2xl bg-navy-900/95 border border-sky-400/80 shadow-2xl backdrop-blur-md jutsu-smoke-entrance space-y-3">
          <div className="flex items-center justify-between border-b border-navy-700/80 pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500" />
              </span>
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                Listening for Voice Command…
              </span>
            </div>
            <button
              onClick={() => setShowDrawer(!showDrawer)}
              className="text-slate-400 hover:text-white transition"
              title="Voice Commands Guide"
              aria-label="Toggle command suggestions"
            >
              <HelpCircle size={15} />
            </button>
          </div>

          {/* Realtime Transcript or Animated Waveform */}
          <div className="p-3 rounded-xl bg-navy-950/90 border border-navy-800 min-h-[46px] flex items-center justify-center text-center">
            {lastTranscript ? (
              <p className="text-xs font-medium text-sky-200">
                "{lastTranscript}"
              </p>
            ) : (
              <div className="flex items-center gap-1.5 h-5">
                <span className="wave-bar" style={{ animationDelay: '0.1s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.3s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.5s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.2s' }} />
                <span className="wave-bar" style={{ animationDelay: '0.4s' }} />
                <span className="text-[11px] text-slate-400 ml-2">Speak now…</span>
              </div>
            )}
          </div>

          {/* Quick command suggestion chips */}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Try saying:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {commandSamples.slice(0, 4).map((s) => (
                <button
                  key={s.cmd}
                  onClick={() => onRunSampleCommand(s.cmd)}
                  className="px-2 py-1 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 hover:border-sky-400/50 text-[11px] text-slate-200 flex items-center gap-1 transition"
                >
                  <s.icon size={11} className="text-sky-400" />
                  "{s.cmd}"
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Mic Trigger Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-full font-bold text-xs shadow-2xl transition-all duration-300 ${
            isListening
              ? 'bg-gradient-to-r from-sky-400 to-blue-500 text-obsidian-950 ring-4 ring-sky-400/30 scale-105'
              : 'bg-navy-900/90 hover:bg-navy-800 border border-navy-700 hover:border-sky-400/60 text-slate-200 hover:text-white backdrop-blur-md'
          }`}
          aria-label={isListening ? 'Stop voice listening' : 'Start voice command listening'}
          title={isListening ? 'Listening active. Click to stop' : 'Click to speak a voice command'}
        >
          {isListening ? (
            <>
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-obsidian-950 opacity-40" />
                <Mic size={16} className="relative text-obsidian-950" />
              </span>
              <span>Voice Active</span>
            </>
          ) : (
            <>
              <Mic size={16} className="text-sky-400" />
              <span>Voice Command</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

