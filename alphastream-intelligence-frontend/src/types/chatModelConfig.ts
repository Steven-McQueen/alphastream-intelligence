/**
 * Structured AI model configuration (settings / admin layer).
 * Mirrors backend-persisted shape planned for Phase 3–4.
 */

export type ChatProviderId = 'google' | 'openai' | 'anthropic' | 'moonshot' | 'deepseek';

export interface ChatModelEntry {
  /** Stable internal ID sent as `model_id` in chat requests */
  model_id: string;
  /** User-facing label in composer and settings */
  display_label: string;
  /** Version string for admin display (e.g. "2.5", "4.6") */
  version: string;
  /** Provider SDK / API model name */
  provider_native_model_name: string;
  /** Model can be selected for chat when also visible */
  enabled: boolean;
  /** Model appears in end-user composer selector */
  visible: boolean;
  /** Default model when no user preference is stored */
  is_default: boolean;
}

export interface ChatProviderEntry {
  provider_id: ChatProviderId;
  name: string;
  models: ChatModelEntry[];
}

export interface ChatModelConfig {
  providers: ChatProviderEntry[];
}

export const CHAT_MODEL_CONFIG_STORAGE_KEY = 'alphastream-chat-model-config';

/** Seed catalog — mirrors Phase 1 Gemini default; OpenAI/Anthropic disabled until Phase 3 */
export const DEFAULT_CHAT_MODEL_CONFIG: ChatModelConfig = {
  providers: [
    {
      provider_id: 'google',
      name: 'Google (Gemini)',
      models: [
        {
          model_id: 'gemini-flash',
          display_label: 'Gemini 2.5 Flash',
          version: '2.5',
          provider_native_model_name: 'gemini-2.5-flash',
          enabled: true,
          visible: true,
          is_default: true,
        },
      ],
    },
    {
      provider_id: 'openai',
      name: 'OpenAI',
      models: [
        {
          model_id: 'gpt-4o',
          display_label: 'GPT-4o',
          version: '4o',
          provider_native_model_name: 'gpt-4o',
          enabled: false,
          visible: false,
          is_default: false,
        },
        {
          model_id: 'gpt-4o-mini',
          display_label: 'GPT-4o Mini',
          version: '4o-mini',
          provider_native_model_name: 'gpt-4o-mini',
          enabled: false,
          visible: false,
          is_default: false,
        },
      ],
    },
    {
      provider_id: 'anthropic',
      name: 'Anthropic',
      models: [
        {
          model_id: 'claude-sonnet',
          display_label: 'Claude Sonnet 4',
          version: '4.6',
          provider_native_model_name: 'claude-sonnet-4-20250514',
          enabled: false,
          visible: false,
          is_default: false,
        },
      ],
    },
    {
      provider_id: 'moonshot',
      name: 'Moonshot (Kimi)',
      models: [
        {
          model_id: 'kimi-k2',
          display_label: 'Kimi K2.6',
          version: 'k2.6',
          provider_native_model_name: 'kimi-k2.6',
          enabled: true,
          visible: true,
          is_default: false,
        },
      ],
    },
    {
      provider_id: 'deepseek',
      name: 'DeepSeek',
      models: [
        {
          model_id: 'deepseek-v4-pro',
          display_label: 'DeepSeek V4 Pro',
          version: 'v4-pro',
          provider_native_model_name: 'deepseek-v4-pro',
          enabled: true,
          visible: true,
          is_default: false,
        },
      ],
    },
  ],
};
