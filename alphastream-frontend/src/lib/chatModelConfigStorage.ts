import type {
  ChatModelConfig,
  ChatModelEntry,
  ChatProviderId,
} from '@/types/chatModelConfig';
import {
  CHAT_MODEL_CONFIG_STORAGE_KEY,
  DEFAULT_CHAT_MODEL_CONFIG,
} from '@/types/chatModelConfig';

export type ChatModelProvider = ChatProviderId;

export interface ComposerModelOption {
  model_id: string;
  label: string;
  provider: ChatModelProvider;
  provider_model_name: string;
  enabled: boolean;
}

function cloneConfig(config: ChatModelConfig): ChatModelConfig {
  return JSON.parse(JSON.stringify(config)) as ChatModelConfig;
}

export function normalizeDefaultFlags(config: ChatModelConfig): ChatModelConfig {
  const next = cloneConfig(config);
  let defaultSet = false;

  for (const provider of next.providers) {
    for (const model of provider.models) {
      if (model.is_default && !defaultSet) {
        defaultSet = true;
      } else if (model.is_default && defaultSet) {
        model.is_default = false;
      }
    }
  }

  if (!defaultSet) {
    const gemini = next.providers
      .find((p) => p.provider_id === 'google')
      ?.models.find((m) => m.model_id === 'gemini-flash');
    if (gemini) {
      gemini.is_default = true;
    } else if (next.providers[0]?.models[0]) {
      next.providers[0].models[0].is_default = true;
    }
  }

  return next;
}

function readConfigFromLocalStorage(): ChatModelConfig {
  try {
    const raw = localStorage.getItem(CHAT_MODEL_CONFIG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatModelConfig;
      if (parsed?.providers?.length) {
        return normalizeDefaultFlags(parsed);
      }
    }
  } catch (e) {
    console.error('Failed to load chat model config:', e);
  }
  return cloneConfig(DEFAULT_CHAT_MODEL_CONFIG);
}

let sharedConfig: ChatModelConfig = readConfigFromLocalStorage();
const listeners = new Set<() => void>();

export function getChatModelConfig(): ChatModelConfig {
  return sharedConfig;
}

export function subscribeChatModelConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setChatModelConfig(config: ChatModelConfig): void {
  sharedConfig = normalizeDefaultFlags(config);
  persistChatModelConfig(sharedConfig);
  listeners.forEach((l) => l());
}

export function loadChatModelConfig(): ChatModelConfig {
  return getChatModelConfig();
}

export function persistChatModelConfig(config: ChatModelConfig): void {
  try {
    localStorage.setItem(CHAT_MODEL_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save chat model config:', e);
  }
}

function entryToComposerOption(
  providerId: ChatProviderId,
  model: ChatModelEntry,
): ComposerModelOption {
  return {
    model_id: model.model_id,
    label: model.display_label,
    provider: providerId,
    provider_model_name: model.provider_native_model_name,
    enabled: model.enabled,
  };
}

export function configToComposerModels(config: ChatModelConfig): ComposerModelOption[] {
  const models: ComposerModelOption[] = [];
  for (const provider of config.providers) {
    for (const model of provider.models) {
      if (model.enabled && model.visible) {
        models.push(entryToComposerOption(provider.provider_id, model));
      }
    }
  }
  return models;
}

export function getDefaultModelIdFromConfig(config: ChatModelConfig): string {
  for (const provider of config.providers) {
    for (const model of provider.models) {
      if (model.is_default && model.enabled) {
        return model.model_id;
      }
    }
  }
  const visible = configToComposerModels(config);
  return visible[0]?.model_id ?? 'gemini-flash';
}
