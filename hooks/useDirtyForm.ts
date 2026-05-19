import { useEffect, useMemo } from "react";

/**
 * Returns true when the form's current state differs from its initial
 * snapshot. Used by the four pilot edit dialogs (Record / Farmer /
 * Household / FarmerAssets) to guard against accidental close + lose work.
 *
 * Comparison is JSON.stringify-based — handles plain objects, arrays, and
 * primitives, which is all the four dialogs carry. Not appropriate for
 * Map / Set / Date / RegExp / functions.
 *
 * Pass `initial = null` while the form hasn't been seeded yet (closed
 * → opening transition before useEffect fires). The hook reports false
 * in that case, so safeClose() doesn't fire the discard confirm on a
 * dialog that never actually loaded its content.
 */
export function useDirtyForm<T>(initial: T | null, current: T): boolean {
  return useMemo(() => {
    if (initial === null || initial === undefined) return false;
    try {
      return JSON.stringify(initial) !== JSON.stringify(current);
    } catch {
      return false;
    }
  }, [initial, current]);
}

/**
 * Browser-level "are you sure you want to leave?" guard while `active`
 * is true. Catches tab close, full-page reload, and external navigation
 * (back/forward, URL bar) while a dialog has unsaved work.
 *
 * In-app close attempts (X button, Cancel button, backdrop click) are
 * handled by the caller's safeClose() wrapper, not by this hook. The
 * browser's beforeunload dialog cannot be styled and only fires for
 * navigations the page can't intercept itself.
 */
export function useBeforeUnloadWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome ignores the returnValue text but still requires it to be
      // set for the dialog to show. Empty string is fine.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
