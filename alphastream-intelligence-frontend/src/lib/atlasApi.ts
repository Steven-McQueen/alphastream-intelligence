import { API_BASE_URL } from '@/config/api';

export interface AtlasAgentNode {
  id: string;
  type: 'agent';
  data: {
    slug: string;
    name: string;
    role: string;
    grounding_mode: string;
    suggested_model_id: string | null;
    tools: string[];
    process_doc: string;
    enabled: boolean;
    visible: boolean;
    is_default: boolean;
  };
}

export interface AtlasToolNode {
  id: string;
  type: 'tool';
  data: { name: string; description: string; used: boolean };
}

export type AtlasNode = AtlasAgentNode | AtlasToolNode;

export interface AtlasEdge {
  id: string;
  source: string;
  target: string;
  type: 'uses' | 'handoff';
}

export interface AtlasGraph {
  nodes: AtlasNode[];
  edges: AtlasEdge[];
}

export interface SchemaTable {
  table: string;
  purpose: string;
  key_columns: string[];
  relationships: string[];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export const fetchAtlasGraph = () => getJson<AtlasGraph>('/api/atlas/graph');
export const fetchAtlasSchema = () =>
  getJson<{ tables: SchemaTable[] }>('/api/atlas/schema');
