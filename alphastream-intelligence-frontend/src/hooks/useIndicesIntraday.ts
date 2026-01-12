import { useEffect, useState } from 'react';

interface SeriesPoint {
  date: string;
  value: number;
}

export function useIndicesIntraday(symbols: string[], interval: string = '5min') {
  const [data, setData] = useState<Record<string, SeriesPoint[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbols.length) return;
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          symbols: symbols.join(','),
          interval,
        });
        const res = await fetch(`http://localhost:8000/api/market/indices/intraday?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch intraday indices');
        const json = await res.json();
        if (cancelled) return;
        setData(json || {});
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
  }, [symbols, interval]);

  return { data, loading, error };
}

