import { useUIStore } from '../../stores/useUIStore';
import IAOSStatusBar, { flowSelectedProvider, flowSelectedModel } from './IAOSStatusBar';
import IAOSDock from './IAOSDock';
import IAOSWindow from './IAOSWindow';
import IAOSProcessPanel from './IAOSProcessPanel';
import IAOSFileManager from './IAOSFileManager';
import GraphCanvas from '../graph/GraphCanvas';
import ProjectBuilder from '../builder/ProjectBuilder';
import AgentPanel from '../agents/AgentPanel';
import FlowAgentsView from './FlowAgentsView';
import FlowBrowser from './FlowBrowser';
import ProviderSettings from '../providers/ProviderSettings';
import OutputViewer from '../outputs/OutputViewer';
import TimelineView from '../timeline/TimelineView';
import ConnectorBrowser from '../connectors/ConnectorBrowser';
import BrianMap from './BrianMap';
import { useProjectStore } from '../../stores/useProjectStore';
import { useGraphStore } from '../../stores/useGraphStore';
import { useChatStore } from '../../stores/useChatStore';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api, API_ORIGIN } from '../../api/client';
import './iaos.css';

// ─── Work Projects List ────────────────────────────────────────
function WorkProjectsList() {
  const { projects, setCurrentProject } = useProjectStore();
  const loadGraph = useGraphStore(s => s.loadGraph);
  const loadHistory = useChatStore(s => s.loadHistory);
  const { openWindow, closeWindow } = useUIStore();

  const handleOpenProject = (p: any) => {
    setCurrentProject(p.id);
    loadGraph(p.id);
    loadHistory(p.id);
    const listWin = useUIStore.getState().iaosWindows.find(w => w.component === 'work');
    if (listWin) closeWindow(listWin.id);
    openWindow('work-graph' as any, `WORK: ${p.name}`, { projectId: p.id });
  };

  const statusColors: Record<string, string> = {
    completato: '#10b981', in_esecuzione: '#f59e0b', pronto: '#3b82f6',
    bozza: '#666', fermato: '#ef4444', bloccato: '#ef4444',
  };

  return (
    <div style={{ padding: 20, color: 'var(--text-primary)' }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: 'rgba(224,230,240,0.9)' }}>Flussi di Lavoro</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {projects.filter((p: any) => !p.workspace_path).map((p: any) => (
          <div key={p.id} onClick={() => handleOpenProject(p)} style={{
            padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.03)'; }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColors[p.status] || '#666', boxShadow: `0 0 6px ${statusColors[p.status] || '#666'}` }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(224,230,240,0.9)' }}>{p.name}</div>
              {p.description && <div style={{ fontSize: 10, color: 'rgba(224,230,240,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>}
            </div>
            <span style={{ fontSize: 9, color: 'rgba(224,230,240,0.3)', textTransform: 'uppercase' }}>{p.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Apps List ──────────────────────────────────────────────────
function AppsList() {
  const [apps, setApps] = useState<any[]>([]);
  const { openWindow, closeWindow } = useUIStore();
  useEffect(() => { api.get<any[]>('/apps').then(setApps).catch(() => {}); }, []);

  return (
    <div style={{ padding: 20, color: 'var(--text-primary)' }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: 'rgba(224,230,240,0.9)' }}>Le tue App</h3>
      {apps.length === 0 ? <div style={{ fontSize: 12, color: 'rgba(224,230,240,0.3)', padding: 20, textAlign: 'center' }}>Nessuna app</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {apps.map(a => (
            <div key={a.name} onClick={() => {
              const w = useUIStore.getState().iaosWindows.find(w => w.component === 'app-gallery');
              if (w) closeWindow(w.id);
              openWindow('app-preview' as any, a.name, { appName: a.name });
            }} style={{
              padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget).style.background = 'rgba(255,255,255,0.03)'; }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: a.running ? '#10b981' : '#555' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(224,230,240,0.9)' }}>{a.name}</div>
              </div>
              {a.running && <span style={{ fontSize: 9, color: '#10b981' }}>LIVE</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Window Content Router ─────────────────────────────────────
function WindowContent({ component, props }: { component: string; props?: Record<string, any> }) {
  switch (component) {
    case 'builder': return <ProjectBuilder />;
    case 'work': return <WorkProjectsList />;
    case 'work-graph': {
      // Load the project before rendering the graph
      const WorkGraph = () => {
        const { setCurrentProject } = useProjectStore();
        const loadGraph = useGraphStore(s => s.loadGraph);
        const loadHistory = useChatStore(s => s.loadHistory);
        const [ready, setReady] = useState(false);
        useEffect(() => {
          const pid = props?.projectId;
          if (pid) {
            setCurrentProject(pid);
            loadGraph(pid);
            loadHistory(pid);
          }
          setReady(true);
        }, []);
        return ready ? <GraphCanvas /> : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(224,230,240,0.4)', fontSize: 13 }}>Caricamento...</div>;
      };
      return <WorkGraph />;
    }
    case 'app-gallery': return <AppsList />;
    case 'app-preview': {
      const appName = props?.appName || '';
      return <iframe src={`/api/v1/apps/${appName}/serve/index.html`} style={{ width: '100%', height: '100%', border: 'none', background: 'white' }} title={appName} />;
    }
    case 'files': return <IAOSFileManager />;
    case 'file-viewer': {
      const filePath = props?.filePath || '';
      const fileName = props?.fileName || 'File';
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        const encoded = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        return <iframe src={`/api/v1/local-files/${encoded.split('/').map(encodeURIComponent).join('/')}`} style={{ width: '100%', height: '100%', border: 'none' }} title={fileName} />;
      }
      return <div style={{ padding: 16, height: '100%', overflow: 'auto' }}><pre style={{ fontSize: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#c9d1d9', lineHeight: 1.6 }}>{props?.content || `File: ${filePath}`}</pre></div>;
    }
    case 'connettori': return <ConnectorBrowser />;
    case 'processes': return <IAOSProcessPanel />;
    case 'settings': return <ProviderSettings />;
    case 'agenti': return <FlowAgentsView />;
    case 'browser': {
      const bUrl = props?.url || '';
      return <FlowBrowser initialUrl={bUrl} />;
    }
    case 'risultati': return <OutputViewer />;
    case 'timeline': return <TimelineView />;
    case 'brianmap': return null; // rendered as fullscreen overlay separately
    default: return <div style={{ padding: 20, color: '#888' }}>{component}</div>;
  }
}

// ─── FLOW Log Entry type ───────────────────────────────────────
type LogEntry = { role: 'user' | 'flow' | 'action'; content: string; actionData?: any; timestamp: string };

// ═══════════════════════════════════════════════════════════════
// MAIN DESKTOP
// ═══════════════════════════════════════════════════════════════
export default function IAOSDesktop() {
  const { iaosWindows, openWindow } = useUIStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; content: string } | null>(null);
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const flowPendingFile = useUIStore(s => s.flowPendingFile);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // Pick up file from Import/FileManager
  useEffect(() => {
    if (flowPendingFile) {
      setPendingFile(flowPendingFile);
      addLog('user', `📎 ${flowPendingFile.name} caricato`);
      useUIStore.getState().setFlowPendingFile(null);
    }
  }, [flowPendingFile]);

  const addLog = (role: LogEntry['role'], content: string, actionData?: any) => {
    setLogs(prev => [...prev.slice(-100), { role, content, timestamp: new Date().toLocaleTimeString(), actionData }]);
  };

  const handleLogClick = (entry: LogEntry) => {
    if (!entry.actionData) return;
    const a = entry.actionData;
    if (a.type === 'open_window') openWindow(a.component, a.title, a.props);
  };

  // Execute actions from AI response
  const executeActions = useCallback((actions: any[]) => {
    for (const a of actions) {
      switch (a.type) {
        case 'open_window':
          openWindow(a.component, a.title || a.component, a.props);
          addLog('action', `Aperto: ${a.title || a.component}`, a);
          break;
        case 'show_result':
          addLog('action', a.content || 'Risultato', a);
          break;
        case 'start_app':
          api.post(`/apps/${a.params?.name}/start`, {}).then(() => addLog('action', `App avviata: ${a.params?.name}`, a)).catch(() => {});
          break;
        case 'stop_app':
          api.post(`/apps/${a.params?.name}/stop`, {}).then(() => addLog('action', `App fermata: ${a.params?.name}`)).catch(() => {});
          break;
      }
    }
  }, [openWindow]);

  const handleSend = async () => {
    if ((!input.trim() && !pendingFile) || loading) return;
    const msg = input.trim();
    setInput('');
    addLog('user', pendingFile ? `${msg || 'Analizza file'} 📎${pendingFile.name}` : msg);

    const newHist = [...history, { role: 'user', content: msg || 'Analizza il file' }];
    setLoading(true);
    try {
      const res = await api.post<{ content: string; actions: any[] }>('/ai/flow', {
        message: msg || 'Analizza il file allegato.',
        file_content: pendingFile?.content,
        file_name: pendingFile?.name,
        provider_id: flowSelectedProvider, model_id: flowSelectedModel,
        history: newHist.slice(-10),
      });
      addLog('flow', res.content);
      setHistory([...newHist, { role: 'assistant', content: res.content }]);
      if (res.actions?.length) executeActions(res.actions);
    } catch (err: any) {
      addLog('flow', `Errore: ${err.message}`);
    } finally {
      setLoading(false);
      setPendingFile(null);
    }
  };

  // File upload
  const handleFileSelect = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      const content = reader.result as string;
      setPendingFile({ name: file.name, content });
      addLog('user', `📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
      try { await api.post('/ai/flow/import', { file_name: file.name, file_content: content }); } catch {}
    };
    reader.readAsText(file);
  };

  // Voice
  const toggleRec = useCallback(() => {
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); r.continuous = true; r.interimResults = true; r.lang = 'it-IT';
    r.onresult = (e: any) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(t); };
    r.onerror = () => setIsRecording(false); r.onend = () => setIsRecording(false);
    recognitionRef.current = r; r.start(); setIsRecording(true);
  }, [isRecording]);

  return (
    <div className="iaos-desktop" style={{ background: 'var(--bg-primary, #0f1219)' }}>
      {/* Grid pattern */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

      {/* ══════ FLOW Volcanic Orb ══════ */}
      <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ width: 300, height: 300, position: 'relative' }}>
          {/* Volcanic eruption streams */}
          {[
            { x: -70, y: -50, w: 100, h: 160, rot: -15, color: '180,30,10', dur: 7 },
            { x: 50, y: -80, w: 70, h: 180, rot: 12, color: '200,40,15', dur: 9 },
            { x: -110, y: 20, w: 90, h: 140, rot: -35, color: '160,25,8', dur: 8 },
            { x: 90, y: 40, w: 80, h: 160, rot: 25, color: '190,35,12', dur: 10 },
            { x: -20, y: -100, w: 120, h: 90, rot: -5, color: '220,50,20', dur: 11 },
            { x: 30, y: 90, w: 100, h: 120, rot: 20, color: '170,30,10', dur: 8.5 },
          ].map((s, i) => (
            <div key={`v-${i}`} style={{ position: 'absolute', left: `calc(50% + ${s.x}px)`, top: `calc(50% + ${s.y}px)`, width: s.w, height: s.h, borderRadius: '50%', background: `radial-gradient(ellipse, rgba(${s.color},0.08) 0%, rgba(${s.color},0.03) 40%, transparent 65%)`, transform: `rotate(${s.rot}deg)`, animation: `flow-lava-${i % 4} ${s.dur}s ease-in-out ${i * 0.7}s infinite alternate`, filter: 'blur(10px)' }} />
          ))}

          {/* Deep magma glow */}
          <div style={{ position: 'absolute', inset: -50, borderRadius: '50%', background: 'radial-gradient(circle, rgba(180,30,10,0.08) 0%, rgba(140,20,5,0.04) 35%, transparent 65%)', animation: 'flow-breathe 6s ease-in-out infinite' }} />

          {/* Volcanic surface — boiling, deforming */}
          <div style={{
            position: 'absolute', inset: 60, borderRadius: '48% 52% 53% 47% / 45% 55% 45% 55%',
            animation: 'flow-core-pulse 5s ease-in-out infinite, flow-boil 8s ease-in-out infinite',
            background: `
              radial-gradient(circle at 30% 25%, rgba(220,60,20,0.18) 0%, transparent 30%),
              radial-gradient(circle at 70% 65%, rgba(200,40,15,0.12) 0%, transparent 25%),
              radial-gradient(circle at 50% 50%, rgba(60,15,5,0.4) 0%, rgba(40,10,5,0.35) 25%, rgba(25,8,3,0.3) 50%, rgba(15,5,3,0.4) 80%, rgba(10,3,2,0.5) 100%)
            `,
            boxShadow: `
              0 0 60px rgba(200,40,15,0.15),
              0 0 120px rgba(180,30,10,0.1),
              0 0 200px rgba(140,20,5,0.06),
              inset 0 0 50px rgba(200,40,15,0.1),
              inset 0 -20px 40px rgba(220,60,20,0.08),
              inset 5px 5px 30px rgba(180,30,10,0.06)
            `,
          }}>
            {/* Lava crack 1 */}
            <div style={{ position: 'absolute', top: '20%', left: '25%', width: '40%', height: '15%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(220,70,20,0.15), rgba(200,40,10,0.08), transparent)', animation: 'flow-lava-0 4s ease-in-out infinite alternate' }} />
            {/* Lava crack 2 */}
            <div style={{ position: 'absolute', top: '55%', left: '40%', width: '30%', height: '20%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(200,50,15,0.12), rgba(180,30,10,0.06), transparent)', animation: 'flow-lava-1 3.5s ease-in-out infinite alternate' }} />
            {/* Central magma core */}
            <div style={{ position: 'absolute', top: '35%', left: '38%', width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,80,20,0.2), rgba(220,50,15,0.1), transparent)', boxShadow: '0 0 30px rgba(220,60,20,0.15)', animation: 'flow-lava-2 3s ease-in-out infinite alternate' }} />
            {/* Surface specular */}
            <div style={{ position: 'absolute', top: '10%', left: '15%', width: '45%', height: '20%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.03), transparent)', transform: 'rotate(-10deg)' }} />
          </div>

          {/* Outer heat ring */}
          <div style={{ position: 'absolute', inset: 55, borderRadius: '50%', boxShadow: '0 0 20px rgba(200,40,15,0.08), inset 0 0 20px rgba(180,30,10,0.04)', animation: 'flow-lava-3 4s ease-in-out infinite alternate' }} />

          {/* FLOW text */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 42, letterSpacing: 18, fontWeight: 800, color: 'rgba(255,245,240,0.22)', textShadow: '0 0 50px rgba(220,50,30,0.3), 0 0 100px rgba(180,30,10,0.15)', fontFamily: '"SF Pro Display", -apple-system, sans-serif', userSelect: 'none' }}>FLOW</div>
        </div>
        <div style={{ position: 'absolute', bottom: -35, left: '50%', transform: 'translateX(-50%)', fontSize: 10, letterSpacing: 6, fontWeight: 300, color: 'rgba(200,40,20,0.1)', textTransform: 'uppercase', userSelect: 'none', whiteSpace: 'nowrap' }}>AI Operating System</div>
      </div>

      {/* Status Bar */}
      <IAOSStatusBar />

      {/* Windows */}
      {iaosWindows.filter(w => w.component !== 'brianmap').map(win => (
        <IAOSWindow key={win.id} win={win}>
          <WindowContent component={win.component} props={win.props} />
        </IAOSWindow>
      ))}

      {/* BrianMap — full-screen overlay */}
      {iaosWindows.some(w => w.component === 'brianmap' && !w.minimized) && (() => {
        const bmWin = iaosWindows.find(w => w.component === 'brianmap')!;
        return (
          <BrianMap
            onOpenWindow={(c, t) => openWindow(c as any, t)}
            onClose={() => useUIStore.getState().closeWindow(bmWin.id)}
          />
        );
      })()}

      {/* ══════ LOG BOX — risposte spostabile ══════ */}
      {logs.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 44, right: 16, bottom: 110,
          width: 380,
          background: 'rgba(12,14,22,0.75)',
          backdropFilter: 'blur(16px)',
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 40,
        }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, fontWeight: 600, color: 'rgba(224,230,240,0.5)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Log FLOW</span>
            <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: 'rgba(224,230,240,0.3)', cursor: 'pointer', fontSize: 10 }}>Pulisci</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {logs.map((entry, i) => (
              <div key={i}
                onClick={() => handleLogClick(entry)}
                style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  cursor: entry.actionData ? 'pointer' : 'default',
                  background: entry.role === 'user' ? 'rgba(59,130,246,0.1)' :
                    entry.role === 'action' ? 'rgba(255,150,50,0.08)' : 'rgba(255,255,255,0.03)',
                  borderLeft: entry.role === 'user' ? '2px solid rgba(59,130,246,0.3)' :
                    entry.role === 'action' ? '2px solid rgba(255,150,50,0.3)' : '2px solid rgba(255,255,255,0.06)',
                  color: entry.role === 'action' ? 'rgba(220,50,30,0.8)' : 'rgba(224,230,240,0.75)',
                }}>
                <span style={{ fontSize: 9, color: 'rgba(224,230,240,0.25)', marginRight: 6 }}>{entry.timestamp}</span>
                {entry.role === 'action' && <span style={{ fontSize: 9, marginRight: 4 }}>⚡</span>}
                {entry.content}
              </div>
            ))}
            {loading && <div style={{ padding: '6px 10px', fontSize: 12, color: 'rgba(220,50,30,0.5)', animation: 'flow-breathe 2s infinite' }}>Elaborazione...</div>}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* ══════ INPUT BOX — centrato in basso, sopra il dock ══════ */}
      <div style={{
        position: 'absolute',
        bottom: 16, left: '50%', transform: 'translateX(-50%)',
        width: 650, maxWidth: 'calc(100% - 40px)',
        zIndex: 60,
      }}>
        {pendingFile && (
          <div style={{ marginBottom: 6, padding: '4px 12px', fontSize: 11, color: 'rgba(220,50,30,0.7)', display: 'flex', alignItems: 'center', gap: 6 }}>
            📎 {pendingFile.name}
            <button onClick={() => setPendingFile(null)} style={{ background: 'none', border: 'none', color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}>✕</button>
          </div>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-secondary, rgba(22,25,35,0.9))',
          backdropFilter: 'blur(20px)',
          borderRadius: 14,
          border: '1px solid var(--border-primary, rgba(255,255,255,0.08))',
          padding: '8px 10px',
        }}>
          <button onClick={() => fileInputRef.current?.click()} style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            color: pendingFile ? 'rgba(220,50,30,0.8)' : 'rgba(224,230,240,0.25)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files)} />
          <button onClick={toggleRec} style={{
            width: 38, height: 38, borderRadius: 10,
            background: isRecording ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
            border: isRecording ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: isRecording ? '#ef4444' : 'rgba(224,230,240,0.25)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            animation: isRecording ? 'flow-breathe 1.5s infinite' : 'none',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isRecording ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={isRecording ? 'Sto ascoltando...' : pendingFile ? 'Cosa vuoi fare con il file?' : 'Chiedi qualsiasi cosa a FLOW...'}
            disabled={loading}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-primary, #e0e6f0)', fontSize: 15, padding: '10px 6px',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            }}
          />
          <button onClick={handleSend} disabled={(!input.trim() && !pendingFile) || loading} style={{
            width: 38, height: 38, borderRadius: 10,
            background: (!input.trim() && !pendingFile) || loading ? 'rgba(255,255,255,0.03)' : 'rgba(220,50,30,0.15)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: (!input.trim() && !pendingFile) || loading ? 'rgba(224,230,240,0.15)' : 'rgba(220,60,40,0.8)',
            cursor: (!input.trim() && !pendingFile) || loading ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>
          </button>
        </div>
      </div>

      {/* Minimized windows — mostrate nella topbar (vedi IAOSStatusBar) */}

      {/* Dock rimosso — items nella topbar */}

      {/* Animations */}
      <style>{`
        @keyframes flow-breathe { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.05);opacity:1} }
        @keyframes flow-core-pulse { 0%,100%{transform:scale(1);box-shadow:0 0 60px rgba(255,120,20,.15),inset 0 0 40px rgba(255,150,30,.1)} 50%{transform:scale(1.04);box-shadow:0 0 80px rgba(255,120,20,.2),inset 0 0 60px rgba(255,150,30,.15)} }
        @keyframes flow-lava-0 { 0%{transform:rotate(-20deg)scale(1);opacity:.4} 50%{transform:rotate(-15deg)scale(1.3);opacity:.8} 100%{transform:rotate(-25deg)scale(.9);opacity:.3} }
        @keyframes flow-lava-1 { 0%{transform:rotate(15deg)scale(.8);opacity:.3} 50%{transform:rotate(20deg)scale(1.2);opacity:.7} 100%{transform:rotate(10deg)scale(1);opacity:.5} }
        @keyframes flow-lava-2 { 0%{transform:rotate(-40deg)scale(1.1);opacity:.5} 50%{transform:rotate(-35deg)scale(.8);opacity:.3} 100%{transform:rotate(-45deg)scale(1.3);opacity:.7} }
        @keyframes flow-lava-3 { 0%{transform:rotate(30deg)scale(.9);opacity:.4} 50%{transform:rotate(35deg)scale(1.4);opacity:.8} 100%{transform:rotate(25deg)scale(1);opacity:.35} }
        @keyframes flow-boil {
          0%   { border-radius: 48% 52% 53% 47% / 45% 55% 45% 55%; transform: scale(1) rotate(0deg); }
          15%  { border-radius: 52% 48% 47% 53% / 50% 50% 50% 50%; transform: scale(1.03) rotate(1deg); }
          30%  { border-radius: 45% 55% 55% 45% / 53% 47% 52% 48%; transform: scale(0.98) rotate(-1deg); }
          45%  { border-radius: 55% 45% 48% 52% / 47% 53% 48% 52%; transform: scale(1.04) rotate(2deg); }
          60%  { border-radius: 50% 50% 52% 48% / 55% 45% 53% 47%; transform: scale(0.97) rotate(-1.5deg); }
          75%  { border-radius: 47% 53% 45% 55% / 48% 52% 55% 45%; transform: scale(1.02) rotate(1deg); }
          100% { border-radius: 48% 52% 53% 47% / 45% 55% 45% 55%; transform: scale(1) rotate(0deg); }
        }
      `}</style>
    </div>
  );
}
