import { useCallback, useEffect, useState } from 'react';
import { fetchAgents, type AgentApiEntry } from '@/lib/agentsApi';

/** Fallback when the API is unavailable — keeps the composer functional. */
const FALLBACK_AGENTS: AgentApiEntry[] = [
  { slug: 'financial_advisor', name: 'Financial Advisor', role: 'specialist', grounding_mode: 'tools' },
];

export function useComposerAgents() {
  const [agents, setAgents] = useState<AgentApiEntry[]>(FALLBACK_AGENTS);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const { agents: list } = await fetchAgents();
      setAgents(list.length > 0 ? list : FALLBACK_AGENTS);
    } catch {
      setAgents(FALLBACK_AGENTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { agents, isLoading, refresh };
}
