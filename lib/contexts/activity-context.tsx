"use client";

/**
 * useActivityLog — lazy, paginated reader for public.activity_logs.
 *
 * Intentionally a bare hook (no Provider) so activity logs never join the
 * AgriDataProvider preload set. Each consumer mounts its own state when the
 * Timeline tab opens; nothing is cached globally. This avoids the
 * "giant context growth" the operational-history plan called out.
 *
 * Pagination is cursor-based on (created_at DESC, id) — never OFFSET/LIMIT,
 * which gets quadratic at scale. The fetch returns 21 rows to detect the
 * presence of a 22nd page without a second round-trip.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityAction, ActivityEntityType, ActivityLog } from "@/lib/data";
import { normalizeActivityLog } from "@/lib/normalize";
import { supabase } from "@/lib/supabase/client";

const PAGE_SIZE = 20;

export type ActivityLogState = {
  entries: ActivityLog[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
};

export type UseActivityLogResult = ActivityLogState & {
  /** Refetch from the newest entry (drops current state). */
  reload: () => Promise<void>;
  /** Append the next older page using the current oldest entry as the cursor. */
  loadMore: () => Promise<void>;
};

/**
 * Fetches activity log entries for one entity, newest first.
 *
 * Disabled (returns idle state) when `enabled === false` or `entityId` is
 * empty — pair with a tab-open boolean so we don't fire on mount of a
 * hidden panel.
 */
export function useActivityLog(
  entityType: ActivityEntityType,
  entityId: string,
  options?: { enabled?: boolean },
): UseActivityLogResult {
  const enabled = options?.enabled !== false && entityId.length > 0;

  const [state, setState] = useState<ActivityLogState>({
    entries: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
  });

  // Guard against a stale fetch resolving after a newer one (or after the
  // component unmounts). Compared inside each Supabase callback.
  const requestSeq = useRef(0);

  const fetchPage = useCallback(
    async (mode: "reload" | "more", cursor?: ActivityLog) => {
      const mySeq = ++requestSeq.current;
      setState((prev) =>
        mode === "reload"
          ? { ...prev, loading: true, error: null }
          : { ...prev, loadingMore: true, error: null },
      );

      let query = supabase
        .from("activity_logs")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (cursor) {
        // Strict-less-than on the composite (created_at, id) cursor. PostgREST
        // doesn't expose row-value comparison, so we split into the standard
        // "older created_at OR (same created_at AND smaller id)" predicate.
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
        );
      }

      const { data, error } = await query;

      if (mySeq !== requestSeq.current) return; // stale; drop result.

      if (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: error.message,
        }));
        return;
      }

      const rows = (data ?? []).map((r) =>
        normalizeActivityLog(r as Record<string, unknown>),
      );
      const hasMore = rows.length > PAGE_SIZE;
      const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

      setState((prev) => ({
        entries: mode === "reload" ? pageRows : [...prev.entries, ...pageRows],
        loading: false,
        loadingMore: false,
        error: null,
        hasMore,
      }));
    },
    [entityType, entityId],
  );

  const reload = useCallback(async () => {
    if (!enabled) return;
    await fetchPage("reload");
  }, [enabled, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!enabled) return;
    setState((prev) => {
      if (!prev.hasMore || prev.loadingMore || prev.loading) return prev;
      const oldest = prev.entries[prev.entries.length - 1];
      if (!oldest) return prev;
      // Fire the next page asynchronously; the state update above is
      // immediate so the UI can lock the button.
      void fetchPage("more", oldest);
      return { ...prev, loadingMore: true };
    });
  }, [enabled, fetchPage]);

  // Auto-fetch on enable + on entity change. Bail when disabled.
  useEffect(() => {
    if (!enabled) return;
    void fetchPage("reload");
    // Invalidate any in-flight stale fetch on cleanup.
    return () => {
      requestSeq.current += 1;
    };
  }, [enabled, fetchPage]);

  return { ...state, reload, loadMore };
}

/* ─────────────────────────────────────────────────────────────────────────
 * useActivityFeed — broader cross-cutting feed for the User Activity panel.
 *
 * Same cursor/pagination shape as useActivityLog, but the WHERE clause is a
 * filter set (entity type / action / performed_by / barangay / date range)
 * rather than a single entity. Reads through the same RLS — barangay users
 * are auto-scoped to their own barangay; admins see all.
 *
 * Filter object is shallowly compared via JSON.stringify so callers can pass
 * literals without memoising. Date strings are ISO timestamps (or YYYY-MM-DD,
 * which PostgREST coerces) — bounds are inclusive `since` / exclusive `until`.
 * ────────────────────────────────────────────────────────────────────── */

export type ActivityFeedFilter = {
  entityType?: ActivityEntityType;
  action?: ActivityAction;
  performedBy?: string;
  barangay?: string;
  /** Inclusive lower bound on created_at (ISO date or timestamp). */
  since?: string;
  /** Exclusive upper bound on created_at. */
  until?: string;
};

const FEED_PAGE_SIZE = 25;

export function useActivityFeed(
  filter: ActivityFeedFilter,
  options?: { enabled?: boolean; pageSize?: number },
): UseActivityLogResult {
  const enabled = options?.enabled !== false;
  const pageSize = options?.pageSize ?? FEED_PAGE_SIZE;

  // Stable filter key — re-fetches only when filter values actually change.
  const filterKey = useMemo(() => JSON.stringify(filter), [filter]);

  const [state, setState] = useState<ActivityLogState>({
    entries: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
  });

  const requestSeq = useRef(0);

  const fetchPage = useCallback(
    async (mode: "reload" | "more", cursor?: ActivityLog) => {
      const mySeq = ++requestSeq.current;
      setState((prev) =>
        mode === "reload"
          ? { ...prev, loading: true, error: null }
          : { ...prev, loadingMore: true, error: null },
      );

      let query = supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(pageSize + 1);

      if (filter.entityType) query = query.eq("entity_type", filter.entityType);
      if (filter.action) query = query.eq("action", filter.action);
      if (filter.performedBy) query = query.eq("performed_by", filter.performedBy);
      if (filter.barangay) query = query.eq("barangay", filter.barangay);
      if (filter.since) query = query.gte("created_at", filter.since);
      if (filter.until) query = query.lt("created_at", filter.until);

      if (cursor) {
        query = query.or(
          `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
        );
      }

      const { data, error } = await query;

      if (mySeq !== requestSeq.current) return;

      if (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          loadingMore: false,
          error: error.message,
        }));
        return;
      }

      const rows = (data ?? []).map((r) =>
        normalizeActivityLog(r as Record<string, unknown>),
      );
      const hasMore = rows.length > pageSize;
      const pageRows = hasMore ? rows.slice(0, pageSize) : rows;

      setState((prev) => ({
        entries: mode === "reload" ? pageRows : [...prev.entries, ...pageRows],
        loading: false,
        loadingMore: false,
        error: null,
        hasMore,
      }));
    },
    // filterKey is the stable shallow-compare key; ESLint can't see through
    // JSON.stringify so we list it explicitly. `filter` itself is read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterKey, pageSize],
  );

  const reload = useCallback(async () => {
    if (!enabled) return;
    await fetchPage("reload");
  }, [enabled, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!enabled) return;
    setState((prev) => {
      if (!prev.hasMore || prev.loadingMore || prev.loading) return prev;
      const oldest = prev.entries[prev.entries.length - 1];
      if (!oldest) return prev;
      void fetchPage("more", oldest);
      return { ...prev, loadingMore: true };
    });
  }, [enabled, fetchPage]);

  useEffect(() => {
    if (!enabled) return;
    void fetchPage("reload");
    return () => {
      requestSeq.current += 1;
    };
  }, [enabled, fetchPage]);

  return { ...state, reload, loadMore };
}
