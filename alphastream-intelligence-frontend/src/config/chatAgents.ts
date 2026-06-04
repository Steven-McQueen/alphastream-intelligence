/**
 * Composer agent selection + persistence.
 * "auto" means: let the backend's heuristic selector pick the agent.
 */

export const AUTO_AGENT_ID = 'auto';

const STORAGE_KEY = 'alphastream-chat-agent-id';

export function getStoredAgentId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || AUTO_AGENT_ID;
  } catch {
    return AUTO_AGENT_ID;
  }
}

export function setStoredAgentId(agentId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, agentId);
  } catch {
    /* localStorage unavailable */
  }
}
