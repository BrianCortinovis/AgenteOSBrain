import { useState, useCallback, useEffect, useRef } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useUIStore } from '../../stores/useUIStore';
import { useGraphStore } from '../../stores/useGraphStore';
import { useChatStore } from '../../stores/useChatStore';
import { executeApi } from '../../api/execute.api';
import { API_ORIGIN } from '../../api/client';

const MIN_NODE_GLOW_MS = 700;

export default function Header() {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const projects = useProjectStore(s => s.projects);
  const updateProject = useProjectStore(s => s.updateProject);
  const loadProjects = useProjectStore(s => s.loadProjects);
  const setCurrentProject = useProjectStore(s => s.setCurrentProject);
  const createProject = useProjectStore(s => s.createProject);
  const deleteProject = useProjectStore(s => s.deleteProject);
  const loadGraph = useGraphStore(s => s.loadGraph);
  const setNodes = useGraphStore(s => s.setNodes);
  const updateNode = useGraphStore(s => s.updateNode);
  const loadHistory = useChatStore(s => s.loadHistory);
  const currentView = useUIStore(s => s.currentView);
  const setView = useUIStore(s => s.setView);
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const toggleChat = useUIStore(s => s.toggleChat);
  const chatOpen = useUIStore(s => s.chatOpen);

  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showDescription, setShowDescription] = useState(false);

  const [execState, setExecState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [executing, setExecuting] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const nodeStartRef = useRef<Record<string, number>>({});
  const completionTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const project = projects.find(p => p.id === currentProjectId);
  const shouldListen = Boolean(
    currentProjectId && (
      execState === 'running' ||
      execState === 'paused' ||
      project?.status === 'in_esecuzione' ||
      project?.status === 'in_pausa'
    )
  );

  const clearCompletionTimer = useCallback((nodeId: string) => {
    const timer = completionTimersRef.current[nodeId];
    if (timer) {
      clearTimeout(timer);
      delete completionTimersRef.current[nodeId];
    }
  }, []);

  const clearAllCompletionTimers = useCallback(() => {
    for (const timer of Object.values(completionTimersRef.current)) {
      clearTimeout(timer);
    }
    completionTimersRef.current = {};
  }, []);

  useEffect(() => {
    if (!currentProjectId) {
      setExecState('idle');
      setExecuting(false);
      setActiveNodeId(null);
      nodeStartRef.current = {};
      clearAllCompletionTimers();
      return;
    }

    let cancelled = false;
    executeApi.getState(currentProjectId)
      .then(({ state }) => {
        if (cancelled) return;
        if (state === 'running' || state === 'paused') {
          setExecState(state);
          return;
        }

        if (project?.status === 'in_esecuzione' || project?.status === 'in_pausa') {
          updateProject(currentProjectId, { status: 'fermato' });
          setExecState('idle');
          return;
        }

        if (project?.status === 'in_esecuzione') {
          setExecState('running');
        } else if (project?.status === 'in_pausa') {
          setExecState('paused');
        } else {
          setExecState('idle');
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (project?.status === 'in_esecuzione') setExecState('running');
        else if (project?.status === 'in_pausa') setExecState('paused');
        else setExecState('idle');
      });

    return () => {
      cancelled = true;
    };
  }, [currentProjectId, project?.status, updateProject, clearAllCompletionTimers]);

  useEffect(() => {
    return () => {
      clearAllCompletionTimers();
    };
  }, [clearAllCompletionTimers]);

  // Subscribe to SSE for real-time node updates
  useEffect(() => {
    if (!shouldListen || !currentProjectId) return;

    const es = new EventSource(`${API_ORIGIN}/api/v1/projects/${currentProjectId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'node_start') {
          clearCompletionTimer(data.nodeId);
          nodeStartRef.current[data.nodeId] = Date.now();
          setActiveNodeId(data.nodeId);
          setExecState('running');
          updateNode(data.nodeId, {
            state: 'in_esecuzione',
            progress: data.progress?.percent || 0,
            status_text: data.message || 'In esecuzione',
            provider_id: data.providerId || undefined,
            model_id: data.modelId || undefined,
            debug_file: data.debugFile || '',
            last_error: '',
          });
        } else if (data.type === 'node_complete') {
          const applyCompletion = () => {
            updateNode(data.nodeId, {
              state: data.status === 'completato' ? 'completato' : 'bloccato',
              progress: data.progress?.percent || 100,
              status_text: data.message || (data.status === 'completato' ? 'Completato' : 'Bloccato'),
              last_error: data.error || '',
              debug_file: data.debugFile || '',
            });
            setActiveNodeId((current) => current === data.nodeId ? null : current);
            clearCompletionTimer(data.nodeId);
          };

          const startedAt = nodeStartRef.current[data.nodeId] || 0;
          const elapsed = startedAt ? Date.now() - startedAt : MIN_NODE_GLOW_MS;
          const remaining = Math.max(0, MIN_NODE_GLOW_MS - elapsed);
          if (remaining > 0) {
            completionTimersRef.current[data.nodeId] = setTimeout(applyCompletion, remaining);
          } else {
            applyCompletion();
          }
        } else if (data.type === 'project_complete') {
          setActiveNodeId(null);
          setExecState('idle');
          loadProjects().catch(() => {});
          loadGraph(currentProjectId);
        }
      } catch {}
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [currentProjectId, shouldListen, loadGraph, loadProjects, updateNode, clearCompletionTimer]);

  const viewLabels: Record<string, string> = {
    mappa: 'Mappa Concettuale',
    agenti: 'Gestione Agenti',
    automazioni: 'Automazioni',
    timeline: 'Timeline',
    prompt: 'Prompt di Sistema',
    connettori: 'Connettori',
    risultati: 'Risultati',
    impostazioni: 'Impostazioni',
    workspace: 'Workspace',
    dashboard: 'Dashboard',
  };

  const handlePlay = useCallback(async () => {
    if (!currentProjectId) return;

    if (execState === 'paused') {
      await executeApi.resume(currentProjectId);
      setExecState('running');
      return;
    }

    clearAllCompletionTimers();
    nodeStartRef.current = {};
    setNodes(
      useGraphStore.getState().nodes.map((node) => ({
        ...node,
        state: 'pronto',
        progress: 0,
        status_text: '',
        last_error: '',
        debug_file: '',
      })),
    );
    setExecuting(true);
    setExecState('running');
    updateProject(currentProjectId, { status: 'in_esecuzione' });

    try {
      await executeApi.executeProject(currentProjectId);
      updateProject(currentProjectId, { status: 'completato' });
      if (currentProjectId) loadGraph(currentProjectId);
    } catch {
      updateProject(currentProjectId, { status: 'bloccato' });
    } finally {
      setExecuting(false);
      setExecState('idle');
      setActiveNodeId(null);
      clearAllCompletionTimers();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, [currentProjectId, execState, updateProject, loadGraph, setNodes, clearAllCompletionTimers]);

  const handlePause = useCallback(async () => {
    if (!currentProjectId) return;
    await executeApi.pause(currentProjectId);
    setExecState('paused');
    updateProject(currentProjectId, { status: 'in_pausa' });
  }, [currentProjectId, updateProject]);

  const handleStop = useCallback(async () => {
    if (!currentProjectId) return;
    await executeApi.stop(currentProjectId);
    setExecState('idle');
    setExecuting(false);
    setActiveNodeId(null);
    clearAllCompletionTimers();
    updateProject(currentProjectId, { status: 'fermato' });
    loadGraph(currentProjectId);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [currentProjectId, updateProject, loadGraph, clearAllCompletionTimers]);

  const statusColors: Record<string, string> = {
    completato: 'var(--accent-green)',
    in_esecuzione: 'var(--accent-amber)',
    in_pausa: '#f59e0b',
    fermato: 'var(--accent-red)',
    bloccato: 'var(--accent-red)',
    pronto: 'var(--accent-blue)',
    bozza: 'var(--text-muted)',
  };

  const statusLabels: Record<string, string> = {
    completato: 'Completato',
    in_esecuzione: 'In Esecuzione',
    in_pausa: 'In Pausa',
    fermato: 'Fermato',
    bloccato: 'Bloccato',
    pronto: 'Pronto',
    bozza: 'Bozza',
  };

  return (
    <div style={{
      height: 48, background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn-icon" onClick={toggleSidebar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
        </button>

        {/* Project Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowProjectMenu(!showProjectMenu)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 6,
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)',
              cursor: 'pointer', color: 'var(--text-primary)', fontSize: 12, fontWeight: 500,
              maxWidth: 220, overflow: 'hidden',
            }}
          >
            {project && (
              <>
                <span className={`status-dot ${project.status || 'bozza'}`} style={{ width: 6, height: 6 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</span>
              </>
            )}
            {!project && <span style={{ color: 'var(--text-muted)' }}>Seleziona progetto</span>}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {showProjectMenu && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4,
              background: 'var(--bg-card)', border: '1px solid var(--border-secondary)',
              borderRadius: 8, padding: 4, minWidth: 240, maxHeight: 300, overflowY: 'auto',
              zIndex: 999, boxShadow: 'var(--shadow-lg)',
            }}>
              {projects.map(p => (
                <button key={p.id} onClick={() => {
                  setCurrentProject(p.id); loadGraph(p.id); loadHistory(p.id); setView('mappa');
                  setShowProjectMenu(false);
                }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 4, textAlign: 'left',
                  background: currentProjectId === p.id ? 'var(--bg-hover)' : 'transparent',
                  color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', border: 'none',
                }}>
                  <span className={`status-dot ${p.status || 'bozza'}`} style={{ width: 6, height: 6 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    {p.description && (
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                        {p.description.split('\n')[0].slice(0, 60)}
                      </div>
                    )}
                  </div>
                  {currentProjectId === p.id && (
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('Eliminare?')) deleteProject(p.id); }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 0, fontSize: 14 }}>&times;</button>
                  )}
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--border-primary)', margin: '4px 0' }} />
              {showNewProject ? (
                <div style={{ display: 'flex', gap: 4, padding: '4px 6px' }}>
                  <input value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                    onKeyDown={async e => { if (e.key === 'Enter' && newProjectName.trim()) {
                      const p = await createProject({ name: newProjectName.trim() });
                      setNewProjectName(''); setShowNewProject(false); setShowProjectMenu(false);
                      loadGraph(p.id); loadHistory(p.id); setView('mappa');
                    }}}
                    placeholder="Nome progetto..." autoFocus
                    style={{ flex: 1, fontSize: 11, padding: '4px 8px' }} />
                  <button className="btn btn-primary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={async () => { if (!newProjectName.trim()) return;
                      const p = await createProject({ name: newProjectName.trim() });
                      setNewProjectName(''); setShowNewProject(false); setShowProjectMenu(false);
                      loadGraph(p.id); loadHistory(p.id); setView('mappa');
                    }}>+</button>
                </div>
              ) : (
                <button onClick={() => setShowNewProject(true)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 10px', borderRadius: 4, textAlign: 'left',
                  background: 'transparent', color: 'var(--accent-blue)', fontSize: 12,
                  cursor: 'pointer', border: 'none',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                  Nuovo progetto
                </button>
              )}
            </div>
          )}
        </div>

        {project && (
          <span style={{
            fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
            padding: '2px 6px', borderRadius: 3,
            background: `${statusColors[project.status] || 'var(--text-muted)'}18`,
            color: statusColors[project.status] || 'var(--text-muted)',
          }}>
            {statusLabels[project.status] || project.status}
          </span>
        )}

        {/* Info button for project description */}
        {project?.description && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDescription(!showDescription)}
              title="Descrizione progetto"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '50%',
                background: showDescription ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                color: showDescription ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border-primary)', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              }}
            >
              i
            </button>
            {showDescription && (
              <div style={{
                position: 'absolute', top: '100%', left: -20, marginTop: 6,
                background: 'var(--bg-card)', border: '1px solid var(--border-secondary)',
                borderRadius: 8, padding: '12px 14px', minWidth: 300, maxWidth: 420,
                zIndex: 999, boxShadow: 'var(--shadow-lg)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                  {project.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {project.description}
                </div>
              </div>
            )}
          </div>
        )}

        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {viewLabels[currentView] || currentView}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* Play/Pause/Stop Controls */}
        {currentProjectId && project && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
            padding: '2px 4px', border: '1px solid var(--border-primary)',
          }}>
            <button
              className="btn-icon"
              onClick={handlePlay}
              disabled={execState === 'running'}
              title={execState === 'paused' ? 'Riprendi' : 'Esegui Progetto'}
              style={{
                color: execState === 'running' ? 'var(--text-muted)' : 'var(--accent-green)',
                opacity: execState === 'running' ? 0.4 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            <button
              className="btn-icon"
              onClick={handlePause}
              disabled={execState !== 'running'}
              title="Pausa"
              style={{
                color: execState === 'running' ? '#f59e0b' : 'var(--text-muted)',
                opacity: execState !== 'running' ? 0.4 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6" y="4" width="4" height="16" rx="1"/>
                <rect x="14" y="4" width="4" height="16" rx="1"/>
              </svg>
            </button>
            <button
              className="btn-icon"
              onClick={handleStop}
              disabled={execState === 'idle' && !executing}
              title="Ferma"
              style={{
                color: (execState !== 'idle' || executing) ? 'var(--accent-red)' : 'var(--text-muted)',
                opacity: (execState === 'idle' && !executing) ? 0.4 : 1,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
            {execState === 'running' && (
              <span className="status-dot in_esecuzione" style={{ marginLeft: 4 }} />
            )}
            {execState === 'paused' && (
              <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, marginLeft: 4 }}>PAUSA</span>
            )}
          </div>
        )}

        {currentProjectId && (
          <button
            className={`btn btn-sm ${chatOpen ? 'btn-primary' : 'btn-secondary'}`}
            onClick={toggleChat}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Chat
          </button>
        )}
      </div>
    </div>
  );
}
