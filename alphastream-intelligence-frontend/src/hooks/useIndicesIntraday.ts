import { useEffect, useState, useMemo } from 'react';

interface SeriesPoint {
  date: string;
  value: number;
}

// Map frontend symbols to FMP API symbols
const SYMBOL_TO_FMP: Record<string, string> = {
  'SPX': '^GSPC',
  'NDX': '^IXIC',
  'DJI': '^DJI',
  'RUT': '^RUT',
  'VIX': '^VIX',
};

// Reverse mapping for response
const FMP_TO_SYMBOL: Record<string, string> = {
  '^GSPC': 'SPX',
  '^IXIC': 'NDX',
  '^DJI': 'DJI',
  '^RUT': 'RUT',
  '^VIX': 'VIX',
};

export function useIndicesIntraday(symbols: string[], interval: string = '5min') {
  const [data, setData] = useState<Record<string, SeriesPoint[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert symbols to FMP format
  const fmpSymbols = useMemo(() =>
    symbols.map(s => SYMBOL_TO_FMP[s.toUpperCase()] || s),
    [symbols]
  );

  useEffect(() => {
    if (!symbols.length) return;
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          symbols: fmpSymbols.join(','),
          interval,
        });
        const res = await fetch(`http://localhost:8000/api/market/indices/intraday?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch intraday indices');
        const json = await res.json();
        if (cancelled) return;

        // Map FMP symbols back to frontend symbols
        const mappedData: Record<string, SeriesPoint[]> = {};
        for (const [key, value] of Object.entries(json)) {
          const frontendSymbol = FMP_TO_SYMBOL[key] || key;
          mappedData[frontendSymbol] = value as SeriesPoint[];
        }
        setData(mappedData);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message ?? 'Failed to fetch intraday indices');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 10_000); // 10s polling to match live feel
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbols, fmpSymbols, interval]);

  return { data, loading, error };
}

