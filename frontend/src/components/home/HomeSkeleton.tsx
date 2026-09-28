/** The chat page's shape (sidebar list, a few messages, the composer) while conversations load. */
export function HomeSkeleton() {
  const bar = "animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800/70";
  return (
    <div role="status" aria-label="Loading your workspace" className="flex min-h-screen bg-white dark:bg-zinc-950">
      <aside className="hidden w-[280px] shrink-0 flex-col gap-3 border-r border-border/40 p-4 md:flex">
        <div className={`${bar} h-8 w-32`} />
        <div className={`${bar} mt-2 h-9 w-full`} />
        {[80, 65, 90, 55, 70, 60].map((w, i) => (
          <div key={i} className={`${bar} h-4`} style={{ width: `${w}%` }} />
        ))}
      </aside>
      <main className="flex flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-6 px-4 py-6">
          <div className={`${bar} ml-auto h-10 w-2/5 rounded-[18px]`} />
          <div className="flex flex-col gap-2">
            <div className={`${bar} h-3 w-16`} />
            <div className={`${bar} h-4 w-full`} />
            <div className={`${bar} h-4 w-11/12`} />
            <div className={`${bar} h-4 w-3/4`} />
          </div>
          <div className={`${bar} ml-auto h-10 w-1/3 rounded-[18px]`} />
        </div>
        <div className="border-t border-border/40 px-4 pb-4 pt-3">
          <div className={`${bar} mx-auto h-14 w-full max-w-[760px] rounded-2xl`} />
        </div>
      </main>
      <span className="sr-only">Loading your workspace…</span>
    </div>
  );
}
