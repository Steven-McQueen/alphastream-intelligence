/**
 * Composer-layer model definitions and persistence helpers.
 * Composer list prefers GET /api/chat/models (see useComposerChatModels).
 * Default model id comes from persisted config (local cache + /api/ai-config).
 */

import {
  getDefaultModelIdFromConfig,
  loadChatModelConfig,
  type ChatModelProvider,
} from '@/lib/chatModelConfigStorage';

export type { ChatModelProvider };

export interface ChatModelDefinition {
  /** Stable internal ID sent as `model_id` in chat requests */
  model_id: string;
  /** User-facing label in the composer selector */
  label: string;
  provider: ChatModelProvider;
  /** Provider-native model string (backend registry resolves in Phase 3) */
  provider_model_name: string;
  /** Whether the model appears in the selector */
  enabled: boolean;
}

/** Static fallback when settings store is empty or unavailable */
export const CHAT_MODELS: readonly ChatModelDefinition[] = [
  {
    model_id: 'gemini-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'google',
    provider_model_name: 'gemini-2.5-flash',
    enabled: true,
  },
] as const;

export const DEFAULT_MODEL_ID = 'gemini-flash';

const STORAGE_KEY = 'alphastream-chat-model-id';

export function getStoredModelId(): string {
  const defaultId = getDefaultModelIdFromConfig(loadChatModelConfig());

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  } catch {
    /* localStorage unavailable */
  }

  return defaultId || DEFAULT_MODEL_ID;
}

export function setStoredModelId(modelId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, modelId);
  } catch {
    /* localStorage unavailable */
  }
}
