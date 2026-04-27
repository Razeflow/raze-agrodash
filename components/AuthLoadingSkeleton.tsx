/** Full-screen layout skeleton while Supabase session is restored. */
export default function AuthLoadingSkeleton() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg)]">
      <div className="hidden w-24 flex-col gap-4 border-r border-slate-200/80 bg-white/60 p-5 lg:flex">
        <div className="h-12 w-12 shrink-0 rounded-2xl skeleton-shimmer" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-12 shrink-0 rounded-[1.5rem] skeleton-shimmer" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-6 p-8 pt-10 sm:p-10">
        <div className="h-10 w-56 max-w-[70%] rounded-xl skeleton-shimmer sm:w-72" />
        <div className="h-4 w-40 rounded-lg skeleton-shimmer" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-3xl skeleton-shimmer sm:h-32" />
          ))}
        </div>
        <div className="h-48 flex-1 rounded-3xl skeleton-shimmer lg:h-64" />
        <div className="h-32 rounded-3xl skeleton-shimmer lg:hidden" />
      </div>
    </div>
  );
}
