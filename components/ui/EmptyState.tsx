"use client";

/**
 * Shared empty-state surface for list views. Use whenever a list has zero
 * rows so the user sees a helpful prompt instead of a blank area.
 *
 * Two common patterns:
 *   - Truly empty ("No farmers registered yet") → primary CTA = "Add farmer"
 *   - Filter-empty ("No records match your filters") → primary CTA = "Clear filters"
 *
 * Keep the copy short and farmer-friendly. The icon is decorative; the
 * heading carries the meaning.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  /** Optional decorative icon (lucide-react component). */
  icon?: LucideIcon;
  /** Short heading, e.g. "No records yet". */
  title: string;
  /** One-sentence supporting copy. */
  description?: string;
  /** Primary call-to-action (button, link, etc.). */
  action?: ReactNode;
  /** Secondary action shown alongside primary. */
  secondaryAction?: ReactNode;
  /** Tighter padding for inline use (e.g. inside a card that already has padding). */
  compact?: boolean;
};

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact,
}: Props) {
  return (
    <div
      className={`flex flex-col items-center text-center ${
        compact ? "py-6" : "py-10"
      }`}
    >
      {Icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Icon size={20} aria-hidden />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
