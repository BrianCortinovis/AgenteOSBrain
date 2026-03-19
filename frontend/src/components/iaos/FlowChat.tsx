import { useState, useRef, useEffect, useCallback } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { api } from '../../api/client';
import { flowSelectedProvider, flowSelectedModel } from './FlowStatusBar';

type Message = { role: 'user' | 'assistant' | 'result'; content: string };
type FlowAction = { type: string; component?: string; title?: string; props?: any; content?: string; params?: any };

export default function FlowChat() {
  const { flowChatOpen, openWindow } = useUIStore();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'FLOW attivo. Chiedimi qualsiasi cosa.' },
  ]);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | null>(null);
  const flowPendingFile = useUIStore(s => s.flowPendingFile);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Pick up file from Import panel
  useEffect(() => {
    if (flowPendingFile) {
      setPendingFile(flowPendingFile);
      setMessages(prev => [...prev, { role: 'user', content: `📎 ${flowPendingFile.name} caricato. Cosa vuoi fare?` }]);
      useUIStore.getState().setFlowPendingFile(null);
    }
  }, [flowPendingFile]);

  // Execute actions returned by AI
  const executeActions = useCallback((actions: FlowAction[]) => {
    for (const action of actions) {
      switch (action.type) {
        case 'open_window':
          if (action.component) {
            openWindow(action.component as any, action.title || action.component, action.props);
          }
          break;
        case 'show_result':
          if (action.content) {
            setMessages(prev => [...prev, { role: 'result', content: action.content! }]);
          }
          break;
        case 'start_app':
          if (action.params?.name) {
            api.post(`/apps/${action.params.name}/start`, {}).catch(() => {});
          }
          break;
        case 'stop_app':
          if (action.params?.name) {
            api.post(`/apps/${action.params.name}/stop`, {}).catch(() => {});
          }
          break;
        case 'create_project':
          if (action.params?.name) {
            api.post('/projects', { name: action.params.name, description: action.params.description || '' }).catch(() => {});
          }
          break;
        case 'build_app':
          // Open builder window with auto-start configuration
          openWindow('builder' as any, 'Builder', {
            autoStart: {
              prompt: (action as any).prompt || '',
              style: (action as any).style,
              colors: (action as any).colors,
              layout: (action as any).layout,
              features: (action as any).features,
              tech: (action as any).tech,
            }
          });
          break;
      }
    }
  }, [openWindow]);

  const handleSend = async () => {
    if ((!input.trim() && !pendingFile) || loading) return;
    const userMsg = input.trim();
    setInput('');

    const displayMsg = pendingFile ? `${userMsg || 'Analizza questo file'}\n📎 ${pendingFile.name}` : userMsg;
    setMessages(prev => [...prev, { role: 'user', content: displayMsg }]);

    const newHistory = [...history, { role: 'user', content: userMsg || 'Analizza il file' }];

    setLoading(true);
    try {
      const response = await api.post<{ content: string; actions: FlowAction[] }>('/ai/flow', {
        message: userMsg || 'Analizza il file allegato e fornisci un riassunto.',
        file_content: pendingFile?.content,
        file_name: pendingFile?.name,
        provider_id: flowSelectedProvider,
        model_id: flowSelectedModel,
        history: newHistory.slice(-10),
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
      setHistory([...newHistory, { role: 'assistant', content: response.content }]);

      // Execute any actions returned by AI
      if (response.actions?.length) {
        executeActions(response.actions);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Errore: ${err.message}` }]);
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  };

  // File handling
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      setPendingFile({ name: file.name, content });
      setMessages(prev => [...prev, { role: 'user', content: `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB) caricato` }]);
      try { await api.post('/ai/flow/import', { file_name: file.name, file_content: content }); } catch {}
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); };

  // Voice
  const toggleRecording = useCallback(() => {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'it-IT';
    r.onresult = (e: any) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(t); };
    r.onerror = () => setIsRecording(false);
    r.onend = () => setIsRecording(false);
    recognitionRef.current = r; r.start(); setIsRecording(true);
  }, [isRecording]);

  return (
    <div
      className={`flow-chat ${flowChatOpen ? '' : 'hidden'}`}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flow-chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="flow-statusbar-dot" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e6f0' }}>FLOW</span>
        </div>
        <button
          onClick={() => useUIStore.getState().toggleFlowChat()}
          style={{ background: 'none', border: 'none', color: 'rgba(224,230,240,0.4)', cursor: 'pointer', fontSize: 16 }}
        >
          x
        </button>
      </div>

      {/* Messages */}
      <div className="flow-chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={
            msg.role === 'user' ? 'flow-msg-user' :
            msg.role === 'result' ? 'flow-msg-result' : 'flow-msg-assistant'
          } style={msg.role === 'result' ? {
            alignSelf: 'stretch',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.15)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
            maxHeight: 300,
            overflowY: 'auto',
          } : undefined}>
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="flow-msg-assistant" style={{ opacity: 0.5 }}>
            <span style={{ animation: 'flow-pulse 1.5s infinite' }}>Elaborazione...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending file */}
      {pendingFile && (
        <div style={{
          padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
          color: 'rgba(255,180,80,0.7)',
        }}>
          <span>📎 {pendingFile.name}</span>
          <button onClick={() => setPendingFile(null)}
            style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer', fontSize: 12 }}>
            ✕
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flow-chat-input-area">
        <button className="flow-mic-btn" onClick={() => fileInputRef.current?.click()} title="Carica file"
          style={{ color: pendingFile ? 'rgba(255,180,80,0.8)' : undefined }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files)} />

        <button className={`flow-mic-btn ${isRecording ? 'recording' : ''}`} onClick={toggleRecording}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={isRecording ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
          </svg>
        </button>

        <input className="flow-chat-input" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={isRecording ? 'Sto ascoltando...' : pendingFile ? 'Cosa vuoi fare con il file?' : 'Chiedi qualsiasi cosa...'}
          disabled={loading}
        />
        <button className="flow-send-btn" onClick={handleSend} disabled={(!input.trim() && !pendingFile) || loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
