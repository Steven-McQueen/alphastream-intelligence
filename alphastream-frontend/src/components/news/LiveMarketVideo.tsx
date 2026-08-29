const LIVE_STREAMS: { id: string; title: string }[] = [
  { id: 'KQp-e_XQnDE', title: 'Live Market Coverage' },
  { id: 'iEpJwprxDdk', title: 'Live Market Coverage 2' },
];

export function LiveMarketVideo() {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-[var(--text-author)]" aria-hidden />
        <h2 className="font-page-heading text-xl font-semibold text-foreground">Live Markets</h2>
        <span className="ml-1 flex items-center gap-1.5 text-xs text-dim">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-positive" />
          </span>
          <span className="font-semibold uppercase tracking-wide text-sub">Live</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {LIVE_STREAMS.map((stream) => (
          <div
            key={stream.id}
            className="aspect-video overflow-hidden rounded-[var(--radius)] border border-border bg-card"
          >
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${stream.id}?autoplay=0`}
              title={stream.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ))}
      </div>
    </section>
  );
}
