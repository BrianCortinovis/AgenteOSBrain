import { create } from 'zustand';
import { graphApi } from '../api/graph.api';

interface GraphState {
  nodes: any[];
  edges: any[];
  selectedNodeId: string | null;
  loading: boolean;
  loadGraph: (projectId: string) => Promise<void>;
  setNodes: (nodes: any[]) => void;
  setEdges: (edges: any[]) => void;
  selectNode: (id: string | null) => void;
  addNode: (projectId: string, data: any) => Promise<any>;
  updateNode: (id: string, data: any) => void;
  removeNode: (id: string) => void;
  addEdge: (projectId: string, data: any) => Promise<void>;
  removeEdge: (id: string) => void;
  saveGraph: (projectId: string) => Promise<void>;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  loading: false,

  loadGraph: async (projectId) => {
    set({ loading: true });
    try {
      const { nodes, edges } = await graphApi.getGraph(projectId);
      set({ nodes, edges, loading: false, selectedNodeId: null });
    } catch { set({ loading: false }); }
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  selectNode: (id) => set({ selectedNodeId: id }),

  addNode: async (projectId, data) => {
    const node = await graphApi.createNode(projectId, data);
    set((s) => ({ nodes: [...s.nodes, node] }));
    return node;
  },

  updateNode: (id, data) => {
    set((s) => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, ...data } : n),
    }));
  },

  removeNode: (id) => {
    set((s) => ({
      nodes: s.nodes.filter(n => n.id !== id),
      edges: s.edges.filter(e => e.source_id !== id && e.target_id !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    }));
  },

  addEdge: async (projectId, data) => {
    const edge = await graphApi.createEdge(projectId, data);
    set((s) => ({ edges: [...s.edges, edge] }));
  },

  removeEdge: (id) => {
    set((s) => ({ edges: s.edges.filter(e => e.id !== id) }));
  },

  saveGraph: async (projectId) => {
    const { nodes, edges } = get();
    await graphApi.saveGraph(projectId, { nodes, edges });
  },
}));
