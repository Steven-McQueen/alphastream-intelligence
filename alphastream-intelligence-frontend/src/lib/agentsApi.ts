import { API_BASE_URL } from '@/config/api';

export interface AgentApiEntry {
  slug: string;
  name: string;
  role: string;
  grounding_mode: string;
}

export interface AgentsResponse {
  agents: AgentApiEntry[];
  default: string;
}

/** Composer agent list — no auth; reflects the enabled+visible registry. */
export async function fetchAgents(): Promise<AgentsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/agents`);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as AgentsResponse;
  return { agents: data.agents ?? [], default: data.default ?? '' };
}
