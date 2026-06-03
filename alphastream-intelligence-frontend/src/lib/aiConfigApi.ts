import { authJson } from '@/lib/authFetch';
import type { ChatModelConfig } from '@/types/chatModelConfig';
import { API_BASE_URL } from '@/config/api';

export interface ChatModelApiEntry {
  id: string;
  display_label: string;
  provider: string;
}

export async function fetchAiConfig(): Promise<ChatModelConfig> {
  return authJson<ChatModelConfig>('/api/ai-config');
}

export async function saveAiConfig(config: ChatModelConfig): Promise<ChatModelConfig> {
  return authJson<ChatModelConfig>('/api/ai-config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

/** Composer list — no auth required; reflects DB enabled+visible. */
export async function fetchComposerModels(): Promise<ChatModelApiEntry[]> {
  const res = await fetch(`${API_BASE_URL}/api/chat/models`);
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { models: ChatModelApiEntry[] };
  return data.models ?? [];
}
