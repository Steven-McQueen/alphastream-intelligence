import { useState, useEffect } from 'react';

interface IntegrationsState {
  interactiveBrokersKey: string;
  interactiveBrokersAccountId: string;
  nordnetConfigured: boolean;
  openAiApiKey: string;
  perplexityApiKey: string;
  marketDataProvider: 'none' | 'alpha-vantage' | 'polygon' | 'fmp';
  marketDataApiKey: string;
}

const STORAGE_KEY = 'alphastream-integrations';

const defaultState: IntegrationsState = {
  interactiveBrokersKey: '',
  interactiveBrokersAccountId: '',
  nordnetConfigured: false,
  openAiApiKey: '',
  perplexityApiKey: '',
  marketDataProvider: 'none',
  marketDataApiKey: '',
};

export function useIntegrationsStore() {
  const [state, setState] = useState<IntegrationsState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...defaultState, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load integrations from localStorage:', e);
    }
    return defaultState;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save integrations to localStorage:', e);
    }
  }, [state]);

  const updateField = <K extends keyof IntegrationsState>(
    field: K,
    value: IntegrationsState[K]
  ) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  return {
    ...state,
    updateField,
    reset: () => setState(defaultState),
  };
}
