export function NewsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
      <div className="space-y-8 xl:col-span-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="pf-skeleton h-[26rem] rounded-xl border border-border bg-card lg:col-span-7" />
          <div className="grid grid-cols-1 gap-5 lg:col-span-5">
            <div className="pf-skeleton h-[12rem] rounded-xl border border-border bg-card" />
            <div className="pf-skeleton h-[12rem] rounded-xl border border-border bg-card" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="pf-skeleton h-64 rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>
      <div className="xl:col-span-4">
        <div className="pf-skeleton h-[32rem] rounded-xl border border-border bg-sidebar-accent" />
      </div>
    </div>
  );
}
