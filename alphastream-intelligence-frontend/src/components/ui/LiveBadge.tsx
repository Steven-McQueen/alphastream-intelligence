import { useEffect, useMemo, useState } from 'react';

interface LiveBadgeProps {
  lastUpdated?: string;
  isLoading?: boolean;
}

export function LiveBadge({ lastUpdated, isLoading }: LiveBadgeProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsAgo = useMemo(() => {
    if (!lastUpdated) return null;
    const ts = new Date(lastUpdated).getTime();
    if (Number.isNaN(ts)) return null;
    return Math.max(0, Math.round((now - ts) / 1000));
  }, [lastUpdated, now]);

  const connected = secondsAgo !== null && secondsAgo < 20;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          connected ? 'bg-emerald-400' : 'bg-amber-400'
        } ${isLoading ? 'animate-pulse' : ''}`}
      />
      <span className="font-medium text-foreground">
        {connected ? 'Live' : 'Reconnecting…'}
      </span>
      <span className="text-[11px] text-muted-foreground">
        Last updated {secondsAgo !== null ? `${secondsAgo}s ago` : '—'}
      </span>
    </div>
  );
}

