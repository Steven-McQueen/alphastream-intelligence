import { useQuery } from '@tanstack/react-query';

export interface TickerItem {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  category: 'equity' | 'macro' | 'crypto' | 'commodity' | 'currency';
  displayFormat?: 'decimal' | 'percent' | 'currency';
}

const API_BASE = 'http://localhost:8000';

export function useGlobalTicker() {
  return useQuery({
    queryKey: ['globalTicker'],
    queryFn: async (): Promise<TickerItem[]> => {
      const [indicesRes, macroRes] = await Promise.all([
        fetch(`${API_BASE}/api/macro/indices`),
        fetch(`${API_BASE}/api/macro/ticker-all`).catch(() => null),
      ]);

      if (!indicesRes.ok) {
        throw new Error('Failed to fetch indices');
      }

      const indices = await indicesRes.json();
      const macroData = macroRes && macroRes.ok ? await macroRes.json() : [];

      const displayOrder = [
        'SPX', 'NDX', 'DJI', 'RUT',
        'US10Y', 'US2Y', 'VIX', 'DXY',
        'BTC', 'ETH', 'GOLD', 'OIL', 'NOKUSD',
      ];

      const allData = [...indices, ...(macroData || [])];

      return displayOrder
        .map((symbol) => allData.find((item: any) => item.symbol === symbol))
        .filter(Boolean) as TickerItem[];
    },
    refetchInterval: 30 * 1000,
    staleTime: 25 * 1000,
  });
}

