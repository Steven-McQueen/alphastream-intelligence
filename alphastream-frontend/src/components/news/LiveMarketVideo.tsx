import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

// 24/7 streams get a new video ID whenever the broadcaster restarts them, and
// YouTube no longer supports channel-based live_stream embeds, so each slot pins
// the current ID and can name a fallback stream to load if the pinned ID dies.
const LIVE_STREAMS: { id: string; title: string; label: string; fallbackId?: string }[] = [
  { id: 'KQp-e_XQnDE', title: 'Live Market Coverage', label: 'Stream 1' },
  // Bloomberg Business News Live; falls back to Sky News if the ID rotates.
  { id: 'QB5BNdBFujE', title: 'Live Market Coverage 2', label: 'Stream 2', fallbackId: 'xDWQ3LkccY8' },
];

// ---- Minimal YouTube IFrame API typings (avoids `any`) --------------------
interface YTPlayer {
  mute: () => void;
  unMute: () => void;
  playVideo: () => void;
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
}
interface YTPlayerOptions {
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onError?: (event: { target: YTPlayer; data: number }) => void;
  };
}
interface YTNamespace {
  Player: new (el: string | HTMLElement, options: YTPlayerOptions) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// Load the IFrame API script once and resolve when YT.Player is available.
let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export function LiveMarketVideo() {
  const playersRef = useRef<(YTPlayer | null)[]>([]);
  const createdRef = useRef(false);
  const [muted, setMuted] = useState<boolean[]>(() => LIVE_STREAMS.map(() => true));

  useEffect(() => {
    if (createdRef.current) return; // guard against StrictMode double-invoke
    createdRef.current = true;
    let cancelled = false;

    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT?.Player) return;
      const origin = window.location.origin;
      LIVE_STREAMS.forEach((stream, i) => {
        let usedFallback = false;
        const player = new window.YT!.Player(`yt-player-${stream.id}`, {
          videoId: stream.id,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            origin,
          },
          events: {
            onReady: (event) => {
              event.target.mute();
              event.target.playVideo();
            },
            onError: (event) => {
              // Dead or rotated stream ID: retry once with the fallback stream.
              if (stream.fallbackId && !usedFallback) {
                usedFallback = true;
                event.target.loadVideoById(stream.fallbackId);
              }
            },
          },
        });
        playersRef.current[i] = player;
      });
    });

    return () => {
      cancelled = true;
      playersRef.current.forEach((p) => p?.destroy?.());
      playersRef.current = [];
      createdRef.current = false;
    };
  }, []);

  const toggleMute = (index: number) => {
    const player = playersRef.current[index];
    if (!player) return;
    const next = !muted[index];
    setMuted((prev) => prev.map((v, i) => (i === index ? next : v)));
    if (next) player.mute();
    else player.unMute();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-[var(--text-author)]" aria-hidden />
        <h2 className="font-page-heading text-xl font-semibold text-foreground">Live Markets</h2>
        <span className="ml-1 flex items-center gap-1.5 text-xs text-dim">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
          </span>
          <span className="font-semibold uppercase tracking-wide text-sub">Live</span>
        </span>

        {/* Per-stream mute toggles (left-aligned, next to the title) */}
        <div className="flex items-center gap-2">
          {LIVE_STREAMS.map((stream, i) => (
            <button
              key={stream.id}
              onClick={() => toggleMute(i)}
              aria-pressed={!muted[i]}
              title={muted[i] ? `Unmute ${stream.label}` : `Mute ${stream.label}`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                muted[i]
                  ? 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  : 'border-[var(--text-author)]/50 bg-sidebar-accent text-foreground'
              )}
            >
              {muted[i] ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span>{stream.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {LIVE_STREAMS.map((stream) => (
          <div
            key={stream.id}
            className="relative aspect-video overflow-hidden rounded-[var(--radius)] border border-border bg-card"
          >
            {/* The IFrame API replaces this div with the player iframe. */}
            <div id={`yt-player-${stream.id}`} className="h-full w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}
