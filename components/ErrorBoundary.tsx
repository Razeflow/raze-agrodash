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
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : String(err ?? "Unknown error"),
    };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, error, info);
    void reportError(error, {
      context: {
        source: "error-boundary",
        scope: "sub-tree",
        label: this.props.label,
        componentStack: info.componentStack ?? null,
      },
    });
  }

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
      </div>
    );
  }
}
