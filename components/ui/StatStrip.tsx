"use client";

import { cn } from "@/lib/utils";

export type StatStripItem = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  accentClass?: string;
};

type StatStripProps = {
  items: StatStripItem[];
  className?: string;
};

export default function StatStrip({ items, className }: StatStripProps) {
  return (
    <div
      className={cn(
        "fade-up flex overflow-x-auto snap-x snap-mandatory rounded-2xl border border-white/40 bg-white/70 px-1 py-3 sm:px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="list"
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          role="listitem"
          className={cn(
            "flex min-w-[9.5rem] shrink-0 snap-start flex-1 flex-col justify-center border-slate-200/60 px-3 py-1 sm:min-w-0 sm:px-4",
            index > 0 && "border-l",
            item.accentClass,
            "rounded-xl transition-colors hover:bg-slate-50/80",
          )}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate" title={item.label}>
            {item.label}
          </p>
          <p
            className="mt-0.5 text-base font-semibold tabular-nums leading-tight tracking-tight text-slate-900 sm:text-lg"
            style={{ fontFamily: "Space Mono, ui-monospace, monospace" }}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-slate-500">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
