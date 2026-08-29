import { useCallback, useEffect, useState } from 'react';
import { fetchComposerModels, type ChatModelApiEntry } from '@/lib/aiConfigApi';
import { configToComposerModels, getChatModelConfig } from '@/lib/chatModelConfigStorage';
import type { ChatModelDefinition } from '@/config/chatModels';
import { CHAT_MODELS } from '@/config/chatModels';

let composerRevision = 0;
const composerListeners = new Set<() => void>();

export function bumpComposerRevision(): void {
  composerRevision += 1;
  composerListeners.forEach((l) => l());
}

function subscribeComposerRevision(listener: () => void): () => void {
  composerListeners.add(listener);
  return () => composerListeners.delete(listener);
}

function apiToDefinitions(models: ChatModelApiEntry[]): ChatModelDefinition[] {
  return models.map((m) => ({
    model_id: m.id,
    label: m.display_label,
    provider: m.provider as ChatModelDefinition['provider'],
    provider_model_name: '',
    enabled: true,
  }));
}

function localFallback(): ChatModelDefinition[] {
  const fromConfig = configToComposerModels(getChatModelConfig()).map((m) => ({
    model_id: m.model_id,
    label: m.label,
    provider: m.provider,
    provider_model_name: m.provider_model_name,
    enabled: m.enabled,
  }));
  if (fromConfig.length > 0) return fromConfig;
  return CHAT_MODELS.filter((m) => m.enabled);
}

export function useComposerChatModels() {
  const [models, setModels] = useState<ChatModelDefinition[]>(localFallback);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiModels = await fetchComposerModels();
      if (apiModels.length > 0) {
        setModels(apiToDefinitions(apiModels));
      } else {
        setModels(localFallback());
      }
    } catch {
      setModels(localFallback());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeComposerRevision(() => {
      refresh();
    });
  }, [refresh]);

  return { models, isLoading, refresh };
}
