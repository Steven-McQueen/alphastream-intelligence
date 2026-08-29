import { authJson } from '@/lib/authFetch';
import { API_BASE_URL } from '@/config/api';

export interface AgentConfig {
  slug: string;
  name: string;
  persona: string;
  role: 'specialist' | 'supervisor';
  grounding_mode: 'inject' | 'tools';
  suggested_model_id: string | null;
  context_sources: unknown[];
  tools: string[];
  process_doc: string;
  enabled: boolean;
  visible: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface AgentToolInfo {
  name: string;
  description: string;
}

export async function fetchAgentConfig(): Promise<AgentConfig[]> {
  const data = await authJson<{ agents: AgentConfig[] }>('/api/agents/config');
  return data.agents ?? [];
}

export async function saveAgentConfig(agents: AgentConfig[]): Promise<AgentConfig[]> {
  const data = await authJson<{ agents: AgentConfig[] }>('/api/agents/config', {
    method: 'PUT',
    body: JSON.stringify({ agents }),
  });
  return data.agents ?? [];
}

export async function fetchAvailableTools(): Promise<AgentToolInfo[]> {
  const res = await fetch(`${API_BASE_URL}/api/agents/tools`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = (await res.json()) as { tools: AgentToolInfo[] };
  return data.tools ?? [];
}
