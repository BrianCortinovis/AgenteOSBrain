import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '../../stores/useChatStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { providersApi } from '../../api/providers.api';
import { api } from '../../api/client';
import { t } from '../../i18n/it';

type VoiceProvider = { id: string; name: string; type: string; available: boolean; description: string };

export default function ChatPanel() {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const { messages, loading, sendMessage, clearHistory } = useChatStore();
  const [input, setInput] = useState('');
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('anthropic');
  const [selectedModel, setSelectedModel] = useState('claude-cli');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sttProvider, setSttProvider] = useState('browser');
  const [ttsProvider, setTtsProvider] = useState('browser');
  const [ttsVoice, setTtsVoice] = useState('alloy');
  const [voiceProviders, setVoiceProviders] = useState<{ stt: VoiceProvider[]; tts: VoiceProvider[] }>({ stt: [], tts: [] });
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    providersApi.getAll().then(p => {
      setProviders(p);
      const available = p.filter((pr: any) => pr.available);
      if (available.length > 0) {
        const anthro = available.find((pr: any) => pr.id === 'anthropic');
        if (anthro) {
          setSelectedProvider('anthropic');
          setSelectedModel(anthro.models[0]?.id || 'claude-cli');
        } else {
          setSelectedProvider(available[0].id);
          setSelectedModel(available[0].models[0]?.id || '');
        }
      }
    }).catch(() => {});

    // Load voice providers
    api.get<{ stt: VoiceProvider[]; tts: VoiceProvider[] }>('/voice/providers')
      .then(data => setVoiceProviders(data))
      .catch(() => {});
  }, []);

  // Auto-speak last assistant message
  useEffect(() => {
    if (!autoSpeak || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant' && !loading) {
      speakText(lastMsg.content);
    }
  }, [messages, loading, autoSpeak]);

  const currentProviderData = providers.find(p => p.id === selectedProvider);
  const models = currentProviderData?.models || [];

  const handleSend = async () => {
    if (!input.trim() || !currentProjectId || loading) return;
    const msg = input;
    setInput('');
    await sendMessage(currentProjectId, msg, selectedProvider, selectedModel);
  };

  // ─── Voice: Start/Stop Recording ────────────────────────────
  const startRecording = useCallback(async () => {
    if (sttProvider === 'browser') {
      // Use Web Speech API (free, Chrome/Edge)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Il tuo browser non supporta il riconoscimento vocale. Usa Chrome o Edge, oppure seleziona OpenAI Whisper nelle impostazioni voce.');
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'it-IT';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };
      recognition.onerror = () => {
        setIsRecording(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } else {
      // Use MediaRecorder to capture audio, then send to Whisper
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            try {
              const data = await api.post<{ text: string }>('/voice/transcribe', {
                audio_base64: base64, language: 'it', stt_provider: 'openai',
              });
              if (data.text) setInput(prev => prev ? `${prev} ${data.text}` : data.text);
            } catch (err) {
              console.error('Transcription error:', err);
            }
          };
          reader.readAsDataURL(audioBlob);
          setIsRecording(false);
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Microphone access error:', err);
        alert('Impossibile accedere al microfono. Controlla i permessi del browser.');
      }
    }
  }, [sttProvider]);

  const stopRecording = useCallback(() => {
    if (sttProvider === 'browser' && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, [sttProvider]);

  // ─── Voice: Text-to-Speech ──────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      return;
    }

    if (ttsProvider === 'browser') {
      // Browser Speech Synthesis (free)
      if (!window.speechSynthesis) {
        alert('Il tuo browser non supporta la sintesi vocale.');
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 5000));
      utterance.lang = 'it-IT';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } else {
      // OpenAI TTS
      try {
        setIsSpeaking(true);
        const data = await api.post<{ audio_base64?: string }>('/voice/speak', {
          text, voice: ttsVoice, tts_provider: 'openai',
        });
        if (data.audio_base64) {
          const audio = new Audio(`data:audio/mpeg;base64,${data.audio_base64}`);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          audio.play();
        } else {
          setIsSpeaking(false);
        }
      } catch {
        setIsSpeaking(false);
      }
    }
  }, [ttsProvider, ttsVoice, isSpeaking]);

  return (
    <div style={{
      width: 380, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-primary)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border-primary)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Chat Copilot</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {/* Voice settings toggle */}
          <button
            className="btn-icon"
            onClick={() => setShowVoiceSettings(!showVoiceSettings)}
            title="Impostazioni Voce"
            style={{ opacity: showVoiceSettings ? 1 : 0.5, color: showVoiceSettings ? 'var(--accent-blue)' : undefined }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          {/* Auto-speak toggle */}
          <button
            className="btn-icon"
            onClick={() => setAutoSpeak(!autoSpeak)}
            title={autoSpeak ? 'Disattiva lettura automatica' : 'Attiva lettura automatica risposte'}
            style={{ opacity: autoSpeak ? 1 : 0.4, color: autoSpeak ? 'var(--accent-green)' : undefined }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              {autoSpeak && <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>}
            </svg>
          </button>
          <button
            className="btn-icon"
            onClick={() => currentProjectId && clearHistory(currentProjectId)}
            title={t('chat.cancella')}
            style={{ opacity: 0.5 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Voice Settings Panel */}
      {showVoiceSettings && (
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid var(--border-primary)',
          background: 'var(--bg-tertiary)', fontSize: 11,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Impostazioni Voce</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ minWidth: 40, color: 'var(--text-muted)' }}>STT:</label>
              <select
                value={sttProvider}
                onChange={e => setSttProvider(e.target.value)}
                style={{ flex: 1, fontSize: 11, padding: '3px 4px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 4 }}
              >
                {voiceProviders.stt.filter(p => p.available).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type === 'free' ? 'Gratis' : 'A pagamento'})</option>
                ))}
                {voiceProviders.stt.length === 0 && (
                  <>
                    <option value="browser">Browser (Gratis)</option>
                    <option value="openai">OpenAI Whisper (A pagamento)</option>
                  </>
                )}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ minWidth: 40, color: 'var(--text-muted)' }}>TTS:</label>
              <select
                value={ttsProvider}
                onChange={e => setTtsProvider(e.target.value)}
                style={{ flex: 1, fontSize: 11, padding: '3px 4px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 4 }}
              >
                {voiceProviders.tts.filter(p => p.available).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.type === 'free' ? 'Gratis' : 'A pagamento'})</option>
                ))}
                {voiceProviders.tts.length === 0 && (
                  <>
                    <option value="browser">Browser (Gratis)</option>
                    <option value="openai">OpenAI TTS (A pagamento)</option>
                  </>
                )}
              </select>
            </div>
            {ttsProvider === 'openai' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ minWidth: 40, color: 'var(--text-muted)' }}>Voce:</label>
                <select
                  value={ttsVoice}
                  onChange={e => setTtsVoice(e.target.value)}
                  style={{ flex: 1, fontSize: 11, padding: '3px 4px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 4 }}
                >
                  <option value="alloy">Alloy (Neutra)</option>
                  <option value="echo">Echo (Maschile)</option>
                  <option value="fable">Fable (Britannica)</option>
                  <option value="onyx">Onyx (Profonda)</option>
                  <option value="nova">Nova (Femminile)</option>
                  <option value="shimmer">Shimmer (Calda)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model Selector */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border-primary)',
        display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg-tertiary)',
      }}>
        <select
          value={selectedProvider}
          onChange={e => {
            const pId = e.target.value;
            setSelectedProvider(pId);
            const prov = providers.find(p => p.id === pId);
            if (prov?.models?.length > 0) setSelectedModel(prov.models[0].id);
          }}
          style={{ fontSize: 11, padding: '4px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 4, minWidth: 90 }}
        >
          {providers.filter(p => p.available).map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          style={{ fontSize: 11, padding: '4px 6px', background: 'var(--bg-input)', border: '1px solid var(--border-primary)', borderRadius: 4, flex: 1, minWidth: 0 }}
        >
          {models.map((m: any) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <span className={`status-dot ${currentProviderData?.available ? 'completato' : 'bloccato'}`} title={currentProviderData?.available ? 'Connesso' : 'Non connesso'} />
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <p style={{ fontSize: 12 }}>{t('chat.vuota')}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Puoi anche usare il microfono per parlare
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={msg.id || i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
          }}>
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--radius-md)',
              background: msg.role === 'user' ? 'var(--accent-blue)' : 'var(--bg-card)',
              color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
              fontSize: 13, lineHeight: 1.5,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </div>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)', marginTop: 2,
              display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'space-between', alignItems: 'center',
            }}>
              <span>{msg.role === 'user' ? 'Tu' : 'Assistente'}</span>
              {msg.role === 'assistant' && (
                <button
                  className="btn-icon"
                  onClick={() => speakText(msg.content)}
                  title={isSpeaking ? 'Ferma lettura' : 'Leggi ad alta voce'}
                  style={{ padding: 2, opacity: 0.5 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 010 7.07"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
            <span className="status-dot in_esecuzione" style={{ display: 'inline-block', marginRight: 6 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Elaborazione...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px', borderTop: '1px solid var(--border-primary)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        {/* Microphone button */}
        <button
          className="btn-icon"
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? 'Ferma registrazione' : 'Registra voce'}
          style={{
            width: 34, height: 34,
            borderRadius: '50%',
            background: isRecording ? 'var(--accent-red)' : 'var(--bg-card)',
            color: isRecording ? 'white' : 'var(--text-secondary)',
            border: isRecording ? '2px solid var(--accent-red)' : '1px solid var(--border-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: isRecording ? 'pulse 1.5s infinite' : 'none',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isRecording ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={isRecording ? 'Sto ascoltando...' : t('chat.placeholder')}
          style={{ flex: 1, fontSize: 13 }}
          disabled={loading}
        />
        <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={loading || !input.trim()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>
          </svg>
        </button>
      </div>

      {/* Recording indicator CSS animation */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
