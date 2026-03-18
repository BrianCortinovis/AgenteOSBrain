import { Handle, Position, type NodeProps } from '@xyflow/react';
import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { useGraphStore } from '../../../stores/useGraphStore';
import { graphApi } from '../../../api/graph.api';
import ConnectorIconsBar from './ConnectorIcons';

const STATE_COLORS: Record<string, string> = {
  bozza: 'var(--text-muted)',
  pronto: 'var(--accent-blue)',
  in_esecuzione: 'var(--accent-amber)',
  completato: 'var(--accent-green)',
  bloccato: 'var(--accent-red)',
};

const TYPE_LABELS: Record<string, string> = {
  sorgente: 'SRC',
  analisi: 'ANL',
  decisione: 'DEC',
  esecuzione: 'EXE',
  memoria: 'MEM',
  automazione: 'AUT',
};

const STATE_LABELS: Record<string, string> = {
  bozza: 'Bozza',
  pronto: 'Pronto',
  in_esecuzione: 'In esecuzione',
  completato: 'Completato',
  bloccato: 'Bloccato',
};

const handleStyle = {
  width: 8,
  height: 8,
  background: 'var(--border-secondary)',
  border: '2px solid var(--bg-card)',
};

function BaseNode({ data, selected, id }: NodeProps) {
  const d = data as any;
  const color = d.color || '#3b82f6';
  const bgColor = d.bgColor || '';
  const stateColor = STATE_COLORS[d.state] || STATE_COLORS.bozza;
  const typeLabel = TYPE_LABELS[d.nodeType] || 'NOD';
  const collapsed = d.collapsed || false;
  const isRunning = d.state === 'in_esecuzione';
  const statusText = d.status_text || STATE_LABELS[d.state] || 'Bozza';
  const progress = Math.max(0, Math.min(100, Number(d.progress || 0)));

  // Extract connector IDs from node config
  const nodeConnectors: string[] = (() => {
    const cfg = tryParseConfig(d.config);
    return cfg.connectors || [];
  })();

  // State-based CSS classes for glow effects
  const stateClass = d.state === 'in_esecuzione' ? ' node-running'
    : d.state === 'completato' ? ' node-completed'
    : d.state === 'bloccato' ? ' node-blocked'
    : '';

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(d.label || 'Nodo');
  const inputRef = useRef<HTMLInputElement>(null);
  const updateNode = useGraphStore(s => s.updateNode);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(d.label || 'Nodo');
    setEditing(true);
  }, [d.label]);

  const handleLabelSave = useCallback(() => {
    setEditing(false);
    if (editValue.trim() && editValue !== d.label) {
      graphApi.updateNode(id, { label: editValue.trim() }).catch(() => {});
      updateNode(id, { label: editValue.trim() });
    }
  }, [editValue, d.label, id, updateNode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') handleLabelSave();
    if (e.key === 'Escape') setEditing(false);
  }, [handleLabelSave]);

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    graphApi.updateNode(id, { config: JSON.stringify({ ...tryParseConfig(d.config), collapsed: !collapsed }) }).catch(() => {});
    updateNode(id, { collapsed: !collapsed });
  }, [id, collapsed, d.config, updateNode]);

  // 4-sided handles for both target and source
  const handles = (
    <>
      {/* Target handles (input) */}
      <Handle type="target" position={Position.Top} id="t-top" style={{ ...handleStyle, top: -4 }} />
      <Handle type="target" position={Position.Bottom} id="t-bottom" style={{ ...handleStyle, bottom: -4 }} />
      <Handle type="target" position={Position.Left} id="t-left" style={{ ...handleStyle, left: -4 }} />
      <Handle type="target" position={Position.Right} id="t-right" style={{ ...handleStyle, right: -4 }} />
      {/* Source handles (output) */}
      <Handle type="source" position={Position.Top} id="s-top" style={{ ...handleStyle, top: -4 }} />
      <Handle type="source" position={Position.Bottom} id="s-bottom" style={{ ...handleStyle, bottom: -4 }} />
      <Handle type="source" position={Position.Left} id="s-left" style={{ ...handleStyle, left: -4 }} />
      <Handle type="source" position={Position.Right} id="s-right" style={{ ...handleStyle, right: -4 }} />
    </>
  );

  // Collapsed view: just the label pill
  if (collapsed) {
    return (
      <div
        className={`custom-node collapsed${selected ? ' selected' : ''}${stateClass}`}
        style={{
          borderColor: color,
          background: bgColor || 'var(--bg-card)',
          borderTopColor: color,
          padding: '6px 12px',
          borderRadius: 8,
          minWidth: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          position: 'relative',
        }}
      >
        {handles}
        <span className={`status-dot ${d.state || 'bozza'}`} style={{ flexShrink: 0 }} />
        {isRunning && <span className="running-chip collapsed">LIVE</span>}
        <span
          className="type-indicator"
          style={{ background: color, width: 6, height: 6, borderRadius: 2, flexShrink: 0 }}
        />

        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleLabelSave}
            onKeyDown={handleKeyDown}
            className="nodrag"
            style={{
              fontSize: 12, fontWeight: 600, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--text-primary)',
              width: Math.max(40, editValue.length * 7),
            }}
          />
        ) : (
          <span
            onDoubleClick={handleLabelDoubleClick}
            style={{ fontSize: 12, fontWeight: 600, cursor: 'text', userSelect: 'none' }}
          >
            {d.label || 'Nodo'}
          </span>
        )}

        {nodeConnectors.length > 0 && (
          <ConnectorIconsBar connectorIds={nodeConnectors} maxVisible={3} size={12} />
        )}
        <button
          onClick={handleToggleCollapse}
          className="nodrag"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4,
            color: 'var(--text-muted)', fontSize: 10, lineHeight: 1,
          }}
          title="Espandi nodo"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>
    );
  }

  // Expanded view — no header, compact body
  return (
    <div
      className={`custom-node${selected ? ' selected' : ''}${stateClass}`}
      style={{
        borderLeft: `3px solid ${color}`,
        background: bgColor || undefined,
        position: 'relative',
      }}
    >
      {handles}

      <div className="custom-node-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span className={`status-dot ${d.state || 'bozza'}`} style={{ flexShrink: 0 }} />
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={handleKeyDown}
              className="nodrag node-label-edit"
              style={{
                fontSize: 13, fontWeight: 600, border: 'none', outline: 'none',
                background: 'transparent', color: 'var(--text-primary)',
                flex: 1, padding: 0,
              }}
            />
          ) : (
            <div
              className="node-label"
              onDoubleClick={handleLabelDoubleClick}
              style={{ cursor: 'text', flex: 1, marginBottom: 0 }}
            >
              {d.label || 'Nodo'}
            </div>
          )}
          {isRunning && <span className="running-chip">LIVE</span>}
          <span style={{ fontSize: 8, color, fontWeight: 700, letterSpacing: 0.5, flexShrink: 0 }}>{typeLabel}</span>
          <button
            onClick={handleToggleCollapse}
            className="nodrag"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
              color: 'var(--text-muted)', fontSize: 10, lineHeight: 1, flexShrink: 0,
            }}
            title="Riduci"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 15l-6-6-6 6"/>
            </svg>
          </button>
        </div>
        {d.description && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.3 }}>
            {d.description.length > 80 ? d.description.slice(0, 80) + '...' : d.description}
          </div>
        )}
        {nodeConnectors.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <ConnectorIconsBar connectorIds={nodeConnectors} maxVisible={6} size={14} />
          </div>
        )}
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: stateColor,
              background: `${stateColor}14`,
              border: `1px solid ${stateColor}30`,
              borderRadius: 999,
              padding: '1px 7px',
              whiteSpace: 'nowrap',
            }}
          >
            {statusText}
          </span>
          {d.debug_file && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>debug</span>
          )}
        </div>
        {(isRunning || d.state === 'completato' || d.state === 'bloccato') && (
          <div style={{ marginTop: 8 }}>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${d.state === 'bloccato' ? Math.max(progress, 12) : progress || (isRunning ? 12 : 100)}%`,
                  height: '100%',
                  background: stateColor,
                  boxShadow: isRunning ? `0 0 16px ${stateColor}` : 'none',
                  transition: 'width 220ms ease',
                }}
              />
            </div>
            {d.last_error && (
              <div style={{ fontSize: 10, color: 'var(--accent-red)', marginTop: 6, lineHeight: 1.35 }}>
                {String(d.last_error).slice(0, 90)}
              </div>
            )}
          </div>
        )}
      </div>

      {(d.agent_id || d.model_id) && (
        <div className="custom-node-footer">
          {d.model_id && <span>{d.model_id}</span>}
          {d.agent_id && <span>Agent</span>}
        </div>
      )}
    </div>
  );
}

function tryParseConfig(config: any): any {
  if (!config) return {};
  try {
    let parsed = typeof config === 'string' ? JSON.parse(config) : config;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  } catch { return {}; }
}

export default memo(BaseNode);
