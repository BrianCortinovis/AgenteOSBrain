import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { useGraphStore } from '../../stores/useGraphStore';
import { api } from '../../api/client';

/* ─── Types ─── */

interface Agent {
  id: string;
  name: string;
  role?: string;
  provider_id: string;
  model_id: string;
  temperature?: number;
  status?: 'idle' | 'running' | 'completed';
  system_prompt?: string;
}

interface OutputEvent {
  id: string;
  title?: string;
  type: string;
  content?: string;
  node_id?: string;
  node_name?: string;
  agent_id?: string;
  provider_id?: string;
  status?: string;
  duration_ms?: number;
  created_at: string;
}

/* ─── Constants ─── */

const AGENT_COLORS = [
  'var(--accent-blue)',
  'var(--accent-green)',
  'var(--accent-amber)',
  'var(--accent-red)',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

const STATUS_COLORS: Record<string, string> = {
  idle: 'var(--text-muted)',
  running: 'var(--accent-amber)',
  completed: 'var(--accent-green)',
  in_esecuzione: 'var(--accent-amber)',
  completato: 'var(--accent-green)',
  bozza: 'var(--text-muted)',
  pronto: 'var(--accent-blue)',
  bloccato: 'var(--accent-red)',
  error: 'var(--accent-red)',
  errore: 'var(--accent-red)',
  log: 'var(--accent-blue)',
  report: '#8b5cf6',
  file: 'var(--accent-green)',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Inattivo',
  running: 'In Esecuzione',
  completed: 'Completato',
  in_esecuzione: 'In Esecuzione',
  completato: 'Completato',
  bozza: 'Bozza',
  pronto: 'Pronto',
  bloccato: 'Bloccato',
  error: 'Errore',
  errore: 'Errore',
  log: 'Log',
  report: 'Report',
  file: 'File',
};

const ROLE_ABBREVIATIONS: Record<string, string> = {
  'Analista': 'ANA',
  'Scrittore': 'SCR',
  'Revisore': 'REV',
  'Ricercatore': 'RIC',
  'Sviluppatore': 'SVL',
  'Designer': 'DES',
  'Pianificatore': 'PIA',
  'Supervisore': 'SUP',
  'Coordinatore': 'CRD',
  'Generatore': 'GEN',
};

function abbreviateRole(role?: string): string {
  if (!role) return '---';
  const found = ROLE_ABBREVIATIONS[role];
  if (found) return found;
  return role.length > 4 ? role.substring(0, 3).toUpperCase() : role.toUpperCase();
}

function formatDuration(ms?: number): string {
  if (ms == null) return '--';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/* ─── Keyframe injection ─── */

const KEYFRAMES_ID = 'timeline-view-keyframes';

function ensureKeyframes() {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes tl-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    @keyframes tl-glow {
      0%, 100% { box-shadow: 0 0 4px rgba(251,191,36,0.3); }
      50% { box-shadow: 0 0 12px rgba(251,191,36,0.6); }
    }
    @keyframes tl-dot-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.6); opacity: 0.6; }
    }
    .tl-scrollbar::-webkit-scrollbar { height: 6px; }
    .tl-scrollbar::-webkit-scrollbar-track { background: var(--bg-tertiary); border-radius: 3px; }
    .tl-scrollbar::-webkit-scrollbar-thumb { background: var(--border-secondary); border-radius: 3px; }
    .tl-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
  `;
  document.head.appendChild(style);
}

/* ─── Component ─── */

export default function TimelineView() {
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const nodes = useGraphStore(s => s.nodes);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<OutputEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isRunning, setIsRunning] = useState(false);

  const eventScrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inject CSS keyframes on mount
  useEffect(() => { ensureKeyframes(); }, []);

  // Map of node connections count
  const nodeConnectionsMap = useMemo(() => {
    const edges = useGraphStore.getState().edges;
    const map: Record<string, number> = {};
    for (const edge of edges) {
      map[edge.source_id] = (map[edge.source_id] || 0) + 1;
      map[edge.target_id] = (map[edge.target_id] || 0) + 1;
    }
    return map;
  }, [nodes]);

  // Count connected nodes for an agent (nodes that reference this agent)
  const getAgentNodeCount = useCallback((agentId: string): number => {
    return nodes.filter(n => n.agent_id === agentId || n.data?.agent_id === agentId).length;
  }, [nodes]);

  const fetchData = useCallback(async () => {
    if (!currentProjectId) return;
    try {
      const [agentsData, outputsData] = await Promise.all([
        api.get<Agent[]>(`/projects/${currentProjectId}/agents`),
        api.get<OutputEvent[]>(`/projects/${currentProjectId}/outputs`),
      ]);
      setAgents(agentsData || []);

      const sorted = (outputsData || []).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setEvents(sorted);

      // Detect if project is running
      const hasRunning = (agentsData || []).some(
        (a: any) => a.status === 'running' || a.status === 'in_esecuzione'
      );
      const hasRunningEvents = sorted.some(
        e => e.status === 'running' || e.status === 'in_esecuzione'
      );
      setIsRunning(hasRunning || hasRunningEvents);
    } catch (err) {
      console.error('[TimelineView] fetch error:', err);
    }
  }, [currentProjectId]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [currentProjectId, fetchData]);

  // Auto-refresh every 3s when running
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (isRunning && currentProjectId) {
      intervalRef.current = setInterval(fetchData, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, currentProjectId, fetchData]);

  const handleZoomIn = () => setZoomLevel(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(z => Math.max(z - 0.25, 0.5));
  const handleZoomReset = () => setZoomLevel(1);

  /* ─── Empty state ─── */

  if (!currentProjectId) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: 14,
      }}>
        Seleziona un progetto per visualizzare la timeline
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: 14,
      }}>
        Caricamento timeline...
      </div>
    );
  }

  /* ─── Render ─── */

  const cardWidth = 200 * zoomLevel;
  const eventCardWidth = 180 * zoomLevel;
  const agentCardGap = 12 * zoomLevel;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: 24,
      gap: 0,
      overflow: 'hidden',
      background: 'var(--bg-primary)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Timeline Esecuzione
          </h2>
          {isRunning && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--accent-amber)',
              background: 'rgba(251,191,36,0.1)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-sm)',
              animation: 'tl-pulse 2s ease-in-out infinite',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--accent-amber)',
                animation: 'tl-dot-pulse 1.5s ease-in-out infinite',
                display: 'inline-block',
              }} />
              IN ESECUZIONE
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          padding: '2px 4px',
        }}>
          <button
            onClick={handleZoomOut}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', borderRadius: 'var(--radius-sm)',
              fontSize: 16, fontWeight: 700,
            }}
            title="Riduci"
          >
            -
          </button>
          <button
            onClick={handleZoomReset}
            style={{
              height: 28, padding: '0 8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', borderRadius: 'var(--radius-sm)',
              fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-mono, monospace)',
            }}
            title="Ripristina zoom"
          >
            {Math.round(zoomLevel * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: 'var(--text-secondary)',
              cursor: 'pointer', borderRadius: 'var(--radius-sm)',
              fontSize: 16, fontWeight: 700,
            }}
            title="Ingrandisci"
          >
            +
          </button>
        </div>
      </div>

      {/* ═══════════════════ AGENT TIMELINE (top) ═══════════════════ */}
      <div style={{
        flexShrink: 0,
        marginBottom: 16,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}>
            Agenti
          </span>
          <span style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            background: 'var(--bg-tertiary)',
            padding: '1px 7px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {agents.length}
          </span>
        </div>

        <div
          className="tl-scrollbar"
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: 8,
          }}
        >
          {agents.length === 0 ? (
            <div style={{
              padding: '20px 0',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}>
              Nessun agente configurato per questo progetto.
            </div>
          ) : (
            <div style={{
              display: 'flex',
              gap: agentCardGap,
              minWidth: 'min-content',
            }}>
              {agents.map((agent, idx) => {
                const color = AGENT_COLORS[idx % AGENT_COLORS.length];
                const status = agent.status || 'idle';
                const statusColor = STATUS_COLORS[status] || 'var(--text-muted)';
                const statusLabel = STATUS_LABELS[status] || status;
                const isAgentRunning = status === 'running' || (status as string) === 'in_esecuzione';
                const connectedNodes = getAgentNodeCount(agent.id);

                return (
                  <div
                    key={agent.id}
                    style={{
                      width: cardWidth,
                      minWidth: cardWidth,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-primary)',
                      borderTop: `3px solid ${color}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      boxShadow: isAgentRunning ? undefined : 'var(--shadow-sm)',
                      animation: isAgentRunning ? 'tl-glow 2s ease-in-out infinite' : undefined,
                      transition: 'box-shadow 0.3s ease',
                      position: 'relative',
                    }}
                  >
                    {/* Agent Name */}
                    <div style={{
                      fontSize: 13 * Math.max(zoomLevel, 0.8),
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {agent.name}
                    </div>

                    {/* Role abbreviation */}
                    <div style={{
                      fontSize: 10 * Math.max(zoomLevel, 0.8),
                      fontWeight: 700,
                      color,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                      fontFamily: 'var(--font-mono, monospace)',
                    }}>
                      {abbreviateRole(agent.role)}
                    </div>

                    {/* Provider / Model badge */}
                    <div style={{
                      display: 'flex',
                      gap: 4,
                      flexWrap: 'wrap',
                      marginBottom: 8,
                    }}>
                      <span style={{
                        fontSize: 9 * Math.max(zoomLevel, 0.8),
                        fontWeight: 500,
                        color: 'var(--accent-blue)',
                        background: 'rgba(59,130,246,0.1)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        whiteSpace: 'nowrap',
                      }}>
                        {agent.provider_id}
                      </span>
                      <span style={{
                        fontSize: 9 * Math.max(zoomLevel, 0.8),
                        fontWeight: 500,
                        color: '#8b5cf6',
                        background: 'rgba(139,92,246,0.1)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: cardWidth - 40,
                      }}>
                        {agent.model_id}
                      </span>
                    </div>

                    {/* Bottom row: status + connected nodes */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      {/* Status indicator */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}>
                        <span style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: statusColor,
                          display: 'inline-block',
                          animation: isAgentRunning ? 'tl-dot-pulse 1.5s ease-in-out infinite' : undefined,
                        }} />
                        <span style={{
                          fontSize: 10 * Math.max(zoomLevel, 0.8),
                          color: statusColor,
                          fontWeight: 500,
                        }}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Connected nodes count */}
                      <span style={{
                        fontSize: 10 * Math.max(zoomLevel, 0.8),
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}>
                        <svg width={10 * Math.max(zoomLevel, 0.8)} height={10 * Math.max(zoomLevel, 0.8)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
                        </svg>
                        {connectedNodes} nodi
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Separator */}
      <div style={{
        height: 1,
        background: 'var(--border-primary)',
        marginBottom: 16,
        flexShrink: 0,
      }} />

      {/* ═══════════════════ EVENT TIMELINE (bottom) ═══════════════════ */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}>
            Eventi di Esecuzione
          </span>
          <span style={{
            fontSize: 10,
            color: 'var(--text-muted)',
            background: 'var(--bg-tertiary)',
            padding: '1px 7px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono, monospace)',
          }}>
            {events.length}
          </span>
        </div>

        {events.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            Nessun evento registrato. Esegui il progetto per visualizzare la timeline.
          </div>
        ) : (
          <div
            ref={eventScrollRef}
            className="tl-scrollbar"
            style={{
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              position: 'relative',
              paddingBottom: 12,
              paddingTop: 8,
            }}
          >
            {/* Horizontal connector line */}
            <div style={{
              position: 'absolute',
              top: 70 * zoomLevel,
              left: 24,
              right: 24,
              height: 2,
              background: 'var(--border-secondary)',
              zIndex: 0,
              minWidth: events.length * (eventCardWidth + 16 * zoomLevel) - 16 * zoomLevel,
            }} />

            <div style={{
              display: 'flex',
              gap: 16 * zoomLevel,
              minWidth: 'min-content',
              position: 'relative',
              zIndex: 1,
            }}>
              {events.map((event, idx) => {
                const status = event.status || event.type || 'log';
                const statusColor = STATUS_COLORS[status] || 'var(--accent-blue)';
                const statusLabel = STATUS_LABELS[status] || status;
                const isEventRunning = status === 'running' || status === 'in_esecuzione';

                // Find matching node name
                const nodeName = event.node_name
                  || nodes.find(n => n.id === event.node_id)?.data?.label
                  || nodes.find(n => n.id === event.node_id)?.name
                  || event.title
                  || `Evento #${idx + 1}`;

                return (
                  <div
                    key={event.id}
                    style={{
                      width: eventCardWidth,
                      minWidth: eventCardWidth,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    {/* Event card */}
                    <div
                      style={{
                        width: '100%',
                        background: 'var(--bg-card)',
                        border: `1px solid ${isEventRunning ? 'var(--accent-amber)' : 'var(--border-primary)'}`,
                        borderRadius: 'var(--radius-md)',
                        padding: '10px 12px',
                        boxShadow: isEventRunning ? '0 0 8px rgba(251,191,36,0.2)' : 'var(--shadow-sm)',
                        animation: isEventRunning ? 'tl-glow 2s ease-in-out infinite' : undefined,
                        position: 'relative',
                      }}
                    >
                      {/* Timestamp */}
                      <div style={{
                        fontSize: 9 * Math.max(zoomLevel, 0.8),
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono, monospace)',
                        marginBottom: 6,
                      }}>
                        {formatTimestamp(event.created_at)}
                      </div>

                      {/* Node name */}
                      <div style={{
                        fontSize: 12 * Math.max(zoomLevel, 0.8),
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: 6,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {nodeName}
                      </div>

                      {/* Status badge */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        marginBottom: 6,
                      }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: statusColor,
                          display: 'inline-block',
                          flexShrink: 0,
                          animation: isEventRunning ? 'tl-dot-pulse 1.5s ease-in-out infinite' : undefined,
                        }} />
                        <span style={{
                          fontSize: 10 * Math.max(zoomLevel, 0.8),
                          fontWeight: 600,
                          color: statusColor,
                        }}>
                          {statusLabel}
                        </span>
                      </div>

                      {/* Duration + Provider row */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {/* Duration */}
                        <span style={{
                          fontSize: 9 * Math.max(zoomLevel, 0.8),
                          fontWeight: 500,
                          color: 'var(--text-secondary)',
                          fontFamily: 'var(--font-mono, monospace)',
                          background: 'var(--bg-tertiary)',
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-sm)',
                        }}>
                          {formatDuration(event.duration_ms)}
                        </span>

                        {/* Provider */}
                        {event.provider_id && (
                          <span style={{
                            fontSize: 9 * Math.max(zoomLevel, 0.8),
                            fontWeight: 500,
                            color: 'var(--accent-blue)',
                            background: 'rgba(59,130,246,0.08)',
                            padding: '1px 5px',
                            borderRadius: 'var(--radius-sm)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: eventCardWidth * 0.45,
                          }}>
                            {event.provider_id}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Connector dot on the timeline */}
                    <div style={{
                      width: 10 * Math.max(zoomLevel, 0.8),
                      height: 10 * Math.max(zoomLevel, 0.8),
                      borderRadius: '50%',
                      background: statusColor,
                      border: '2px solid var(--bg-card)',
                      marginTop: 8,
                      flexShrink: 0,
                      animation: isEventRunning ? 'tl-dot-pulse 1.5s ease-in-out infinite' : undefined,
                    }} />

                    {/* Order indicator */}
                    <div style={{
                      fontSize: 9 * Math.max(zoomLevel, 0.8),
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono, monospace)',
                      marginTop: 4,
                    }}>
                      #{idx + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer stats bar */}
      <div style={{
        flexShrink: 0,
        marginTop: 12,
        display: 'flex',
        gap: 20,
        alignItems: 'center',
        padding: '8px 12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 11,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono, monospace)',
      }}>
        <span>
          Agenti: <strong style={{ color: 'var(--text-secondary)' }}>{agents.length}</strong>
        </span>
        <span>
          Eventi: <strong style={{ color: 'var(--text-secondary)' }}>{events.length}</strong>
        </span>
        <span>
          Nodi: <strong style={{ color: 'var(--text-secondary)' }}>{nodes.length}</strong>
        </span>
        {events.length > 0 && (
          <span>
            Durata totale:{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>
              {formatDuration(
                events.reduce((sum, e) => sum + (e.duration_ms || 0), 0)
              )}
            </strong>
          </span>
        )}
        {isRunning && (
          <span style={{ marginLeft: 'auto', color: 'var(--accent-amber)' }}>
            Auto-refresh ogni 3s
          </span>
        )}
      </div>
    </div>
  );
}
