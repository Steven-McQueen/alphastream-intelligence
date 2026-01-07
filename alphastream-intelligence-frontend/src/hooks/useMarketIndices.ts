import { useQuery } from '@tanstack/react-query';

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  updatedAt?: string;
}

const API_BASE = 'http://localhost:8000';

export function useMarketIndices() {
  return useQuery({
    queryKey: ['marketIndices'],
    queryFn: async (): Promise<MarketIndex[]> => {
      const response = await fetch(`${API_BASE}/api/macro/indices`);
      if (!response.ok) throw new Error('Failed to fetch indices');
      const data = await response.json();
      return (data || []).map((item: any) => ({
        symbol: item.symbol,
        name: item.name,
        value: item.value ?? 0,
        change: item.change ?? 0,
        changePercent: item.changePercent ?? item.change_pct ?? item.change_percent ?? 0,
        updatedAt: item.last_updated,
      }));
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}

export function useUS10Y() {
  return useQuery({
    queryKey: ['us10y'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/macro/treasury-history?days=365`);
      if (!response.ok) throw new Error('Failed to fetch treasury data');
      const data = await response.json();
      const latest = data?.[data.length - 1];
      const prev = data?.[data.length - 2];
      const latestValue = latest?.yield_10y ?? latest?.yield10Y ?? 0;
      const prevValue = prev?.yield_10y ?? prev?.yield10Y ?? latestValue;
      const change = latestValue - prevValue;
      const changePercent = prevValue ? (change / prevValue) * 100 : 0;
      return {
        symbol: 'US10Y',
        name: 'US 10Y Yield',
        value: latestValue,
        change,
        changePercent,
        updatedAt: latest?.date,
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}

export function useVIX() {
  return useQuery({
    queryKey: ['vix'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/macro/vix-history?days=365`);
      if (!response.ok) throw new Error('Failed to fetch VIX data');
      const data = await response.json();
      const latest = data?.[data.length - 1];
      const prev = data?.[data.length - 2];
      const latestValue = latest?.vix_value ?? latest?.vixValue ?? 0;
      const prevValue = prev?.vix_value ?? prev?.vixValue ?? latestValue;
      const change = latestValue - prevValue;
      const changePercent = prevValue ? (change / prevValue) * 100 : 0;
      return {
        symbol: 'VIX',
        name: 'Volatility Index',
        value: latestValue,
        change,
        changePercent,
        updatedAt: latest?.date,
      };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}

