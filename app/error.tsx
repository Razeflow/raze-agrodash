"use client";

/**
 * Route-segment error boundary. Wraps page.tsx + nested layouts/templates
 * under app/. Catches render-time errors thrown inside the segment and
 * shows a recoverable fallback while reporting the failure to app_errors.
 *
 * Pairs with app/global-error.tsx (catches errors in the root layout itself).
 *
 * Next 16: the recovery prop is `unstable_retry`, not the older `reset`.
 * See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md
 */

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { reportError } from "@/lib/error-log";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app/error] route-segment error", error);
    void reportError(error, {
      context: {
        source: "error-boundary",
        scope: "route-segment",
        digest: error.digest ?? null,
      },
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur-xl">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle size={24} aria-hidden />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Something went wrong</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          A problem prevented this view from loading. The error has been recorded.
          You can try again, or reload the page if the issue persists.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-slate-400">
            ref: <span className="select-all">{error.digest}</span>
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <RotateCcw size={16} aria-hidden />
            Try again
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
