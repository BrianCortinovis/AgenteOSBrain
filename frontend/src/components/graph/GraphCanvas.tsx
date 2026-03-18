import { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  ReactFlowProvider,
  type Connection,
  type NodeTypes,
  type Node,
  type Edge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../stores/useGraphStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useUIStore } from '../../stores/useUIStore';
import { graphApi } from '../../api/graph.api';
import BaseNode from './nodes/BaseNode';
import GraphToolbar from './GraphToolbar';
import { getLayoutedElements } from './useAutoLayout';

const NODE_TYPE_COLORS: Record<string, string> = {
  sorgente: '#3b82f6',
  analisi: '#8b5cf6',
  decisione: '#f59e0b',
  esecuzione: '#10b981',
  memoria: '#6366f1',
  automazione: '#ec4899',
};

const nodeTypes: NodeTypes = {
  sorgente: BaseNode,
  analisi: BaseNode,
  decisione: BaseNode,
  esecuzione: BaseNode,
  memoria: BaseNode,
  automazione: BaseNode,
};

function parseNodeConfig(config: any): any {
  if (!config) return {};
  try {
    let parsed = typeof config === 'string' ? JSON.parse(config) : config;
    if (typeof parsed === 'string') parsed = JSON.parse(parsed);
    return parsed;
  } catch { return {}; }
}

function dbNodesToFlow(dbNodes: any[]): Node[] {
  return dbNodes.map(n => {
    const cfg = parseNodeConfig(n.config);
    return {
      id: n.id,
      type: n.type || 'sorgente',
      position: { x: n.position_x || 0, y: n.position_y || 0 },
      data: {
        label: n.label,
        description: n.description,
        state: n.state,
        nodeType: n.type,
        color: n.color || NODE_TYPE_COLORS[n.type] || '#3b82f6',
        bgColor: n.bgColor || cfg.bgColor || '',
        collapsed: n.collapsed || cfg.collapsed || false,
        agent_id: n.agent_id,
        provider_id: n.provider_id,
        model_id: n.model_id,
        system_prompt: n.system_prompt,
        progress: n.progress || 0,
        status_text: n.status_text || '',
        last_error: n.last_error || '',
        debug_file: n.debug_file || '',
        config: n.config,
      },
      style: { width: cfg.collapsed ? undefined : (n.width || 200) },
    };
  });
}

function dbEdgesToFlow(dbEdges: any[]): Edge[] {
  return dbEdges.map(e => ({
    id: e.id,
    source: e.source_id,
    target: e.target_id,
    label: e.label,
    animated: true,
    style: { stroke: 'var(--border-secondary)' },
  }));
}

function flowNodesToDb(flowNodes: Node[]): any[] {
  return flowNodes.map(n => ({
    id: n.id,
    type: n.type || 'sorgente',
    label: n.data?.label || 'Nodo',
    description: n.data?.description || '',
    state: n.data?.state || 'bozza',
    color: n.data?.color || '',
    config: n.data?.config || {},
    position_x: n.position?.x || 0,
    position_y: n.position?.y || 0,
    width: n.measured?.width || n.style?.width || 200,
    height: n.measured?.height || 80,
    agent_id: n.data?.agent_id || '',
    provider_id: n.data?.provider_id || '',
    model_id: n.data?.model_id || '',
    system_prompt: n.data?.system_prompt || '',
  }));
}

function flowEdgesToDb(flowEdges: Edge[]): any[] {
  return flowEdges.map(e => ({
    id: e.id,
    source_id: e.source,
    target_id: e.target,
    label: (e.label as string) || '',
    condition: '',
  }));
}

export default function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner() {
  const { fitView } = useReactFlow();
  const currentProjectId = useProjectStore(s => s.currentProjectId);
  const graphNodes = useGraphStore(s => s.nodes);
  const graphEdges = useGraphStore(s => s.edges);
  const selectNode = useGraphStore(s => s.selectNode);
  const setInspectorOpen = useUIStore(s => s.setInspectorOpen);

  const [nodes, setNodes, onNodesChange] = useNodesState(dbNodesToFlow(graphNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(dbEdgesToFlow(graphEdges));

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNodes(dbNodesToFlow(graphNodes));
    setEdges(dbEdgesToFlow(graphEdges));
    // Auto fit-view when graph changes (new project loaded)
    setTimeout(() => fitView({ padding: 0.25, maxZoom: 0.85, duration: 400 }), 100);
  }, [graphNodes, graphEdges]);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!currentProjectId) return;
      const dbNodes = flowNodesToDb(nodes);
      const dbEdges = flowEdgesToDb(edges);
      graphApi.saveGraph(currentProjectId, { nodes: dbNodes, edges: dbEdges }).catch(() => {});
    }, 1500);
  }, [currentProjectId, nodes, edges]);

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    debouncedSave();
  }, [onNodesChange, debouncedSave]);

  const handleEdgesChange = useCallback((changes: any) => {
    onEdgesChange(changes);
    debouncedSave();
  }, [onEdgesChange, debouncedSave]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges(eds => addEdge({ ...connection, animated: true, style: { stroke: 'var(--border-secondary)' } }, eds));
    debouncedSave();
  }, [setEdges, debouncedSave]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    selectNode(node.id);
    setInspectorOpen(true);
  }, [selectNode, setInspectorOpen]);

  const onPaneClick = useCallback(() => {
    selectNode(null);
    setInspectorOpen(false);
  }, [selectNode, setInspectorOpen]);

  const handleAutoLayout = useCallback((direction: 'TB' | 'LR' = 'TB') => {
    const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(nodes, edges, {
      direction,
      nodeWidth: 240,
      nodeHeight: 100,
      rankSep: 180,
      nodeSep: 140,
    });
    setNodes(layouted);
    setEdges(layoutedEdges);
    setTimeout(() => fitView({ padding: 0.25, maxZoom: 0.85, duration: 400 }), 50);
    // Save after layout
    if (currentProjectId) {
      setTimeout(() => {
        const dbNodes = flowNodesToDb(layouted);
        const dbEdges = flowEdgesToDb(layoutedEdges);
        graphApi.saveGraph(currentProjectId, { nodes: dbNodes, edges: dbEdges }).catch(() => {});
      }, 200);
    }
  }, [nodes, edges, setNodes, setEdges, fitView, currentProjectId]);

  if (!currentProjectId) return null;

  const toolbarBtnStyle = {
    display: 'flex' as const, alignItems: 'center' as const, gap: 5,
    padding: '6px 12px', borderRadius: 6,
    background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
    color: 'var(--text-secondary)', fontSize: 11, fontWeight: 500,
    cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 0.85 }}
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.05}
        maxZoom={2}
        deleteKeyCode="Delete"
        defaultEdgeOptions={{ animated: true }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border-primary)" />
        <Controls position="bottom-left" />
        <MiniMap
          style={{ background: 'var(--bg-secondary)' }}
          nodeColor={(n) => (n.data?.color as string) || '#3b82f6'}
          maskColor="rgba(0,0,0,0.7)"
        />
        <Panel position="top-left">
          <GraphToolbar />
        </Panel>
        <Panel position="top-right">
          <div style={{ display: 'flex', gap: 6 }}>
            {/* Auto-layout verticale */}
            <button onClick={() => handleAutoLayout('TB')} title="Auto-layout verticale (top→bottom)" style={toolbarBtnStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="4" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/>
                <rect x="8.5" y="17" width="7" height="4" rx="1"/><path d="M6.5 7v4h11V7M12 11v6"/>
              </svg>
              Layout ↓
            </button>
            {/* Auto-layout orizzontale */}
            <button onClick={() => handleAutoLayout('LR')} title="Auto-layout orizzontale (left→right)" style={toolbarBtnStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="4" height="7" rx="1"/><rect x="3" y="14" width="4" height="7" rx="1"/>
                <rect x="17" y="8.5" width="4" height="7" rx="1"/><path d="M7 6.5h4v11H7M11 12h6"/>
              </svg>
              Layout →
            </button>
            {/* Inquadra tutto */}
            <button onClick={() => fitView({ padding: 0.25, maxZoom: 0.85, duration: 300 })} title="Inquadra tutti i nodi" style={toolbarBtnStyle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
              Inquadra tutto
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
