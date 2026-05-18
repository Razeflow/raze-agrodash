"use client";

/**
 * Pilot Hardening (Week 3 item 12) — visible "some data failed to load"
 * banner. Reads from AgriLoadStatusContext (which AgriDataProvider
 * populates after each Promise.all). The banner is dismissible per
 * session — clicking the × hides it for the rest of the SPA lifecycle so
 * the user can keep working with partial data; a fresh reload brings it
 * back if errors persist.
 *
 * Designed to sit at the top of the dashboard shell, above the header.
 * Compact (single row), amber, with a Retry button that triggers a
 * provider re-fetch.
 */

import { useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useAgriLoadStatus } from "@/lib/contexts/load-status-context";

export default function ProviderLoadBanner() {
  const { loadErrors, loading, retryLoad } = useAgriLoadStatus();
  const [dismissed, setDismissed] = useState(false);

  const failedTables = Object.keys(loadErrors);
  if (failedTables.length === 0) return null;
  if (dismissed) return null;

  // Format a compact comma list, with smart truncation when many tables fail.
  const tableSummary =
    failedTables.length <= 3
      ? failedTables.join(", ")
      : `${failedTables.slice(0, 2).join(", ")} +${failedTables.length - 2} more`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-800 shadow-sm backdrop-blur lg:mx-6"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="font-medium">Some data failed to load.</p>
        <p className="mt-0.5 truncate text-xs text-amber-700/90">
          Affected: <span className="font-mono">{tableSummary}</span>. The dashboard is showing what loaded; click Retry to try again.
        </p>
      </div>
      <button
        type="button"
        onClick={() => retryLoad()}
        disabled={loading}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} aria-hidden />
        {loading ? "Retrying…" : "Retry"}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-xl p-1 text-amber-700/70 transition hover:bg-white/60 hover:text-amber-900"
        aria-label="Dismiss"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
