import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

export interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;   // vertical gap between layers
  nodeSep?: number;   // horizontal gap between siblings
}

const DEFAULTS: Required<LayoutOptions> = {
  direction: 'TB',
  nodeWidth: 240,
  nodeHeight: 100,
  rankSep: 160,
  nodeSep: 120,
};

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options?: LayoutOptions,
): { nodes: Node[]; edges: Edge[] } {
  const opts = { ...DEFAULTS, ...options };
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSep,
    nodesep: opts.nodeSep,
    marginx: 60,
    marginy: 60,
  });

  for (const node of nodes) {
    const w = (node.measured?.width || node.style?.width as number) || opts.nodeWidth;
    const h = (node.measured?.height || 80) || opts.nodeHeight;
    g.setNode(node.id, { width: w, height: h });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const layoutedNodes = nodes.map(node => {
    const pos = g.node(node.id);
    const w = (node.measured?.width || node.style?.width as number) || opts.nodeWidth;
    const h = (node.measured?.height || 80) || opts.nodeHeight;
    return {
      ...node,
      position: {
        x: pos.x - w / 2,
        y: pos.y - h / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
