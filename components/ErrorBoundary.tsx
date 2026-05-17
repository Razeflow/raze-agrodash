"use client";

/**
 * Sub-tree class-component error boundary for wrapping fragile children
 * (charts, analytics, third-party widgets) so that a single component crash
 * does not blank the whole dashboard.
 *
 * Use sparingly — prefer app/error.tsx for route-segment failures. This is
 * only for cases where you want the rest of the page to keep rendering when
 * one section breaks.
 *
 * Usage:
 *   <ErrorBoundary label="Analytics" fallback={<p>Analytics unavailable.</p>}>
 *     <CommodityAnalytics />
 *   </ErrorBoundary>
 *
 * Errors are reported to app_errors via reportError. The boundary itself
 * never throws and never re-renders its children automatically — the parent
 * can pass a changing `resetKey` prop to force a reset attempt.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/error-log";

const IS_DEV = process.env.NODE_ENV !== "production";

type Props = {
  /** Sub-tree to render. */
  children: ReactNode;
  /** Short label used in reportError context (e.g. "KpiCards"). */
  label: string;
  /** Custom fallback. If omitted, a minimal inline error card is shown. */
  fallback?: ReactNode;
  /** When this value changes, the boundary clears its error state and re-renders children. */
  resetKey?: unknown;
};

type State = {
  hasError: boolean;
  message: string | null;
  stack: string | null;
  componentStack: string | null;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null, stack: null, componentStack: null };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err ?? "Unknown error"),
      stack: err instanceof Error && typeof err.stack === "string" ? err.stack : null,
      componentStack: null,
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: null, stack: null, componentStack: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info);
    this.setState({ componentStack: info.componentStack ?? null });
    void reportError(error, {
      context: {
        source: "error-boundary",
        scope: "sub-tree",
        label: this.props.label,
        componentStack: info.componentStack ?? null,
      },
    });
  }

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-700">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle size={16} aria-hidden />
          <span>{this.props.label} couldn&apos;t load</span>
        </div>
        <p className="text-xs text-red-600/80">
          This section failed to render. The rest of the page should still work.
        </p>
        {IS_DEV && this.state.message ? (
          <details className="mt-1 w-full rounded-xl border border-red-100 bg-white/50 p-2 text-xs text-red-700" open>
            <summary className="cursor-pointer font-semibold">Dev details</summary>
            <p className="mt-1 font-mono text-red-700">{this.state.message}</p>
            {this.state.stack ? (
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-red-700/90">
                {this.state.stack}
              </pre>
            ) : null}
            {this.state.componentStack ? (
              <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-red-700/80">
                Component stack:{this.state.componentStack}
              </pre>
            ) : null}
          </details>
        ) : null}
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-1 rounded-xl border border-red-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-white"
        >
          Reload page
        </button>
      </div>
    );
  }
}
