"use client";

/**
 * Pilot Hardening (Week 3 item 12) — provider load-status surface.
 *
 * Before: AgriDataProvider fired a `Promise.all` of 7 Supabase selects on
 * mount and on auth change. Any per-table failure was logged silently to
 * the console; the rest of the app rendered with empty arrays. That made
 * partial-load failures (one stale RLS policy, one missing index, one
 * paused Supabase project) invisible to the user, who instead saw a
 * dashboard that "just happens to be empty today."
 *
 * Now: AgriDataProvider populates `loadErrors` keyed by table name
 * whenever any of the seven fetches comes back with an error or throws.
 * A small banner component (`ProviderLoadBanner`) subscribes here and
 * surfaces a top-bar "Some data failed to load. [Retry]" message.
 * Clicking Retry bumps a counter that re-runs the load effect.
 *
 * Lives outside the four split contexts (Farmers/Programs/Records/Metrics)
 * because none of them has a natural slot for "ambient load state."
 * Wrapped INSIDE AgriDataProvider so it sees auth context but the four
 * data contexts can read it via the hook if they ever need to.
 */

import { createContext, useContext, type ReactNode } from "react";

export type AgriLoadStatusContextValue = {
  /** Map of table name → error message for any tables that failed to load.
   *  Empty object means everything loaded cleanly. */
  loadErrors: Record<string, string>;
  /** True while the load effect is in flight. */
  loading: boolean;
  /** Triggers a fresh load. Cancels any in-flight fetch via the effect's
   *  cleanup, then re-runs the Promise.all. */
  retryLoad: () => void;
};

export const AgriLoadStatusContext = createContext<AgriLoadStatusContextValue | null>(null);

export function AgriLoadStatusProvider({
  value,
  children,
}: {
  value: AgriLoadStatusContextValue;
  children: ReactNode;
}) {
  return (
    <AgriLoadStatusContext.Provider value={value}>
      {children}
    </AgriLoadStatusContext.Provider>
  );
}

/** Read the load status. Safe to call from any descendant of
 *  AgriDataProvider; returns a no-op default if called from outside the
 *  tree (e.g. login screen) so consumers never need to null-check. */
export function useAgriLoadStatus(): AgriLoadStatusContextValue {
  const ctx = useContext(AgriLoadStatusContext);
  if (!ctx) {
    return {
      loadErrors: {},
      loading: false,
      retryLoad: () => {
        /* no-op */
      },
    };
  }
  return ctx;
}
