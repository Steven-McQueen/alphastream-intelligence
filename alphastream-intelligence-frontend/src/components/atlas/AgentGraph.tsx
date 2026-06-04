import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import type { AtlasGraph, AtlasNode } from '@/lib/atlasApi';

export type LayoutMode = 'hierarchical' | 'organic';

const NODE_W = 168;
const NODE_H = 44;

// index.css stores colors as HSL triplets, so they must be wrapped in hsl().
const C = {
  border: 'hsl(var(--border))',
  primary: 'hsl(var(--primary))',
  primaryFg: 'hsl(var(--primary-foreground))',
  card: 'hsl(var(--card))',
  foreground: 'hsl(var(--foreground))',
  muted: 'hsl(var(--muted))',
  mutedFg: 'hsl(var(--muted-foreground))',
};

function nodeStyle(n: AtlasNode): React.CSSProperties {
  if (n.type === 'agent') {
    const supervisor = n.data.role === 'supervisor';
    return {
      width: NODE_W,
      borderRadius: 10,
      border: `1px solid ${C.border}`,
      background: supervisor ? C.primary : C.card,
      color: supervisor ? C.primaryFg : C.foreground,
      fontSize: 12,
      fontWeight: 600,
      padding: '8px 10px',
      opacity: n.data.enabled === false ? 0.5 : 1,
    };
  }
  return {
    width: NODE_W - 24,
    borderRadius: 8,
    border: `1px dashed ${C.border}`,
    background: C.muted,
    color: C.mutedFg,
    fontSize: 11,
    fontFamily: 'monospace',
    padding: '6px 8px',
    opacity: n.type === 'tool' && n.data.used === false ? 0.45 : 1,
  };
}

function hierarchical(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 64 });
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

/** Agents on an inner ring, tools on an outer ring — a spread "organic" view. */
function organic(nodes: Node[]): Node[] {
  const agents = nodes.filter((n) => n.type === 'agent');
  const tools = nodes.filter((n) => n.type === 'tool');
  const place = (arr: Node[], radius: number, cx = 420, cy = 320) =>
    arr.map((n, i) => {
      const a = (i / Math.max(arr.length, 1)) * Math.PI * 2;
      return { ...n, position: { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) } };
    });
  return [...place(agents, 150), ...place(tools, 320)];
}

export function AgentGraph({
  graph,
  layout,
  onSelect,
}: {
  graph: AtlasGraph;
  layout: LayoutMode;
  onSelect: (node: AtlasNode) => void;
}) {
  const byId = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  );

  const { nodes, edges } = useMemo(() => {
    const rfNodes: Node[] = graph.nodes.map((n) => ({
      id: n.id,
      position: { x: 0, y: 0 },
      data: { label: n.type === 'agent' ? n.data.name : n.data.name },
      style: nodeStyle(n),
      type: 'default',
    }));
    const rfEdges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.type === 'handoff',
      style: {
        stroke: e.type === 'handoff' ? C.primary : C.border,
        strokeWidth: e.type === 'handoff' ? 2 : 1,
      },
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
    const positioned =
      layout === 'hierarchical' ? hierarchical(rfNodes, rfEdges) : organic(rfNodes);
    return { nodes: positioned, edges: rfEdges };
  }, [graph, layout]);

  return (
    <div className="h-[600px] w-full rounded-lg border border-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => {
          const original = byId.get(node.id);
          if (original) onSelect(original);
        }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
