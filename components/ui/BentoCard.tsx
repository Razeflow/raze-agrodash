"use client";
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type BentoCardProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  noPadding?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
};

export default function BentoCard({
  children,
  title,
  subtitle,
  icon: Icon,
  action,
  className,
  noPadding = false,
  collapsible = false,
  defaultExpanded = true,
}: BentoCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasHeader = title || subtitle || Icon || action || collapsible;

  return (
    <div
      className={cn(
        "bg-white/70 backdrop-blur-xl border border-white/40 rounded-[2.5rem] shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all duration-500 flex flex-col group",
        noPadding ? "" : "p-8",
        className
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex justify-between items-start",
            noPadding ? "px-8 pt-8" : "",
            collapsible ? "cursor-pointer select-none" : "",
            (!collapsible || expanded) && children ? "mb-6" : ""
          )}
          onClick={collapsible ? () => setExpanded(!expanded) : undefined}
        >
          <div className="flex items-center gap-3">
            {collapsible && (
              expanded
                ? <ChevronDown size={16} className="text-slate-300 shrink-0" />
                : <ChevronRight size={16} className="text-slate-300 shrink-0" />
            )}
            <div>
              {title && (
                <h3 className="text-slate-900 font-extrabold text-xl tracking-tight leading-none mb-1 group-hover:text-emerald-700 transition-colors">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {action}
            {Icon && (
              <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                <Icon className="w-5 h-5" />
              </div>
            )}
          </div>
        </div>
      )}
      {(!collapsible || expanded) && (
        <div className={cn("flex-1", noPadding && hasHeader ? "mt-4" : "")}>
          {children}
        </div>
      )}
    </div>
  );
}
