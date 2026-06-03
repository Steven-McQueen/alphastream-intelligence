import { useCallback, useEffect, useSyncExternalStore, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAiConfig, saveAiConfig } from '@/lib/aiConfigApi';
import { bumpComposerRevision } from '@/hooks/useComposerChatModels';
import {
  configToComposerModels,
  getDefaultModelIdFromConfig,
  getChatModelConfig,
  setChatModelConfig,
  subscribeChatModelConfig,
  type ComposerModelOption,
} from '@/lib/chatModelConfigStorage';
import type {
  ChatModelConfig,
  ChatModelEntry,
  ChatProviderEntry,
  ChatProviderId,
} from '@/types/chatModelConfig';
import { DEFAULT_CHAT_MODEL_CONFIG } from '@/types/chatModelConfig';

export type { ComposerModelOption };

function cloneConfig(config: ChatModelConfig): ChatModelConfig {
  return JSON.parse(JSON.stringify(config)) as ChatModelConfig;
}

function commitConfig(next: ChatModelConfig): void {
  setChatModelConfig(next);
}

export function useChatModelConfigStore() {
  const { user } = useAuth();
  const config = useSyncExternalStore(subscribeChatModelConfig, getChatModelConfig, () =>
    DEFAULT_CHAT_MODEL_CONFIG,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoadError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const remote = await fetchAiConfig();
        if (!cancelled) {
          commitConfig(remote);
          bumpComposerRevision();
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load AI config');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const replaceConfig = useCallback(async (next: ChatModelConfig) => {
    setIsSaving(true);
    try {
      const saved = user ? await saveAiConfig(next) : next;
      commitConfig(saved);
      bumpComposerRevision();
      return true;
    } catch {
      commitConfig(next);
      bumpComposerRevision();
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  const resetToDefaults = useCallback(async () => {
    const defaults = cloneConfig(DEFAULT_CHAT_MODEL_CONFIG);
    await replaceConfig(defaults);
  }, [replaceConfig]);

  const updateProvider = useCallback(
    (providerId: ChatProviderId, patch: Partial<Pick<ChatProviderEntry, 'name'>>) => {
      const next = cloneConfig(getChatModelConfig());
      const provider = next.providers.find((p) => p.provider_id === providerId);
      if (!provider) return;
      Object.assign(provider, patch);
      commitConfig(next);
    },
    [],
  );

  const updateModel = useCallback(
    (
      providerId: ChatProviderId,
      modelId: string,
      patch: Partial<
        Pick<
          ChatModelEntry,
          | 'display_label'
          | 'version'
          | 'provider_native_model_name'
          | 'enabled'
          | 'visible'
          | 'is_default'
        >
      >,
    ) => {
      const next = cloneConfig(getChatModelConfig());
      const provider = next.providers.find((p) => p.provider_id === providerId);
      const model = provider?.models.find((m) => m.model_id === modelId);
      if (!provider || !model) return;

      Object.assign(model, patch);

      if (patch.is_default === true) {
        for (const p of next.providers) {
          for (const m of p.models) {
            m.is_default = m.model_id === modelId && p.provider_id === providerId;
          }
        }
      }

      if (patch.enabled === false && model.is_default) {
        model.is_default = false;
      }

      commitConfig(next);
    },
    [],
  );

  const setDefaultModel = useCallback((modelId: string) => {
    const next = cloneConfig(getChatModelConfig());
    let found = false;
    for (const provider of next.providers) {
      for (const model of provider.models) {
        const isTarget = model.model_id === modelId;
        if (isTarget) found = true;
        model.is_default = isTarget;
      }
    }
    if (found) commitConfig(next);
  }, []);

  const getEnabledVisibleModels = useCallback((): ComposerModelOption[] => {
    return configToComposerModels(config);
  }, [config]);

  const getDefaultModelId = useCallback((): string => {
    return getDefaultModelIdFromConfig(config);
  }, [config]);

  const findModel = useCallback(
    (modelId: string): { provider: ChatProviderEntry; model: ChatModelEntry } | undefined => {
      for (const provider of config.providers) {
        const model = provider.models.find((m) => m.model_id === modelId);
        if (model) return { provider, model };
      }
      return undefined;
    },
    [config],
  );

  return {
    config,
    isLoading,
    isSaving,
    loadError,
    replaceConfig,
    resetToDefaults,
    updateProvider,
    updateModel,
    setDefaultModel,
    getEnabledVisibleModels,
    getDefaultModelId,
    findModel,
  };
}
