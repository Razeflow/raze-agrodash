"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import AuthLoadingSkeleton from "@/components/AuthLoadingSkeleton";
import { debug, error as logError, mount, transition, warn } from "@/lib/debug";

/**
 * Hard ceiling on the initial-session-restore phase. If `getSession()`
 * hangs or throws silently and we never resolve `loading=false`, the app
 * white-screens (the provider renders nothing). After this timeout we
 * force loading=false so the user lands on the LoginPage and can retry.
 *
 * Tune up if extension workers regularly see "could not restore session"
 * banners on cold networks; tune down only if you're sure auth is healthy.
 */
const AUTH_RESTORE_TIMEOUT_MS = 10_000;

// ── Types (exported so downstream can import) ──────────────────────────

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "BARANGAY_USER";

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  barangay: string | null;
};

export type ManagedUser = {
  username: string;
  displayName: string;
  role: UserRole;
  barangay: string | null;
};

export type AuthContextValue = {
  user: UserProfile | null;
  isLoggedIn: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isBarangayUser: boolean;
  isAdminOrAbove: boolean;
  userBarangay: string | null;
  userRole: UserRole | null;
  login: (username: string, password: string) => Promise<true | string>;
  logout: () => void;
  changePassword: (
    current: string,
    newPw: string,
    confirmPw: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resetUserPassword: (username: string, newPw: string) => Promise<boolean>;
  allUsers: ManagedUser[];
  /** True when the previously-signed-in user was signed out unexpectedly
   * (token revoked, expired, signed out from another tab). The LoginPage
   * shows a friendly banner when this is set. Cleared on next login. */
  sessionExpired: boolean;
  /** Manually dismiss the session-expired banner. */
  clearSessionExpired: () => void;
  /** Set when the initial session-restore phase failed (network error or
   * the AUTH_RESTORE_TIMEOUT_MS hard ceiling). LoginPage surfaces a
   * banner. Distinct from `sessionExpired` (which fires after a known
   * good session was revoked). */
  restoreError: string | null;
  /** Manually dismiss the restore-error banner. */
  clearRestoreError: () => void;
};

// ── Constants ─────────────────────────────────────────────────────────

const EMAIL_DOMAIN = "@agridash.local";

// ── Context ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ────────────────────────────────────────────────────────────

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}${EMAIL_DOMAIN}`;
}

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  barangay: string | null;
};

function rowToProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    barangay: row.barangay,
  };
}

// ── Provider ───────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const logoutInProgressRef = useRef(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);
  /** Set true when the initial session-restore phase fails (throw or timeout).
   * Surfaces as a banner on LoginPage so users know to retry instead of
   * staring at a frozen screen. */
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string): Promise<UserProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, role, barangay")
        .eq("id", userId)
        .single<ProfileRow>();
      if (error || !data) return null;
      return rowToProfile(data);
    },
    [],
  );

  // ── Session restoration + auth state subscription ─────────────────
  //
  // Pilot hardening (white-screen fix): the prior version awaited
  // `getSession()` with no try/catch and gated render on `loading=true`.
  // Any throw inside the IIFE left `loading` true forever, producing a
  // permanent blank screen on reload (Supabase rejection, slow network,
  // stale auth cookie, env var miss). Now:
  //   1. wrap the restore in try/catch so a throw still resolves loading
  //   2. enforce a hard timeout so a HANG also resolves loading
  //   3. surface a friendly restoreError so users can retry instead of
  //      staring at a frozen page (rendered as a banner on LoginPage)
  useEffect(() => {
    mount("AuthProvider");
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function finishLoading(reason: "ok" | "throw" | "timeout", detail?: string) {
      if (cancelled) return;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (reason !== "ok") {
        warn(`Auth: restore failed (${reason})`, detail ?? "");
        setRestoreError(
          reason === "timeout"
            ? "Couldn't reach the server in time. Please sign in again."
            : "Couldn't restore your previous session. Please sign in again.",
        );
      }
      transition("Auth", "loading", "ready", { reason, hasSession: reason === "ok" });
      setLoading(false);
    }

    timeoutId = setTimeout(() => finishLoading("timeout"), AUTH_RESTORE_TIMEOUT_MS);

    (async () => {
      try {
        debug("Auth: getSession() start");
        const { data, error: sessionErr } = await supabase.auth.getSession();
        if (cancelled) return;
        if (sessionErr) {
          // Supabase returned an explicit error — treat as no-session, but log.
          logError("Auth: getSession() returned error", sessionErr);
          finishLoading("throw", sessionErr.message);
          return;
        }
        const session = data?.session ?? null;
        if (session?.user) {
          debug("Auth: session restored, fetching profile", { userId: session.user.id });
          try {
            const profile = await fetchProfile(session.user.id);
            if (cancelled) return;
            if (!profile) {
              warn("Auth: session valid but profile missing — signing out for safety");
              // Best-effort sign-out so RLS doesn't think we're still that user.
              try { await supabase.auth.signOut(); } catch { /* ignore */ }
              setUser(null);
            } else {
              setUser(profile);
            }
          } catch (profileErr) {
            if (cancelled) return;
            logError("Auth: fetchProfile threw", profileErr);
            // Don't strand the user — clear local user state and proceed to login.
            setUser(null);
          }
        }
        finishLoading("ok");
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        finishLoading("throw", msg);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        logoutInProgressRef.current &&
        (event === "TOKEN_REFRESHED" || event === "SIGNED_IN")
      ) {
        return;
      }
      if (event === "SIGNED_OUT" || !session?.user) {
        const wasIntentional = logoutInProgressRef.current;
        logoutInProgressRef.current = false;
        // Functional setter so we see the latest `user` value (the closure
        // could be stale). If a user was previously signed in and this
        // wasn't an intentional logout, surface the session-expired banner.
        setUser((prev) => {
          if (prev && !wasIntentional) setSessionExpired(true);
          return null;
        });
        setAllUsers([]);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const profile = await fetchProfile(session.user.id);
        setUser(profile);
      }
    });

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
      sub.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // ── Fetch all users (admin and above only) ────────────────────────
  useEffect(() => {
    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      setAllUsers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, display_name, role, barangay")
        .order("role", { ascending: true })
        .order("username", { ascending: true });
      if (cancelled || error || !data) return;
      setAllUsers(
        data.map((r) => ({
          username: r.username,
          displayName: r.display_name,
          role: r.role,
          barangay: r.barangay,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // ── login ──────────────────────────────────────────────────────────
  const login = useCallback(
    async (username: string, password: string): Promise<true | string> => {
      const email = usernameToEmail(username);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return error?.message?.includes("Invalid login credentials")
          ? "Incorrect username or password."
          : (error?.message || "Login failed. Please try again.");
      }
      const profile = await fetchProfile(data.user.id);
      if (!profile) return "Account is missing a profile. Contact an administrator.";
      setUser(profile);
      // Successful sign-in clears any prior expired-session / restore banner.
      setSessionExpired(false);
      setRestoreError(null);
      return true;
    },
    [fetchProfile],
  );

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);
  const clearRestoreError = useCallback(() => setRestoreError(null), []);

  // ── logout ─────────────────────────────────────────────────────────
  // Clear UI immediately; finish signOut before router.refresh() so middleware
  // cannot refresh cookies while the session is still valid (would re-trigger
  // TOKEN_REFRESHED and repopulate `user`). Ignore TOKEN_REFRESHED/SIGNED_IN
  // while logoutInProgressRef is true.
  const logout = useCallback(() => {
    logoutInProgressRef.current = true;
    setUser(null);
    setAllUsers([]);
    void supabase.auth.signOut().finally(() => {
      logoutInProgressRef.current = false;
      router.refresh();
    });
  }, [router]);

  // ── changePassword ─────────────────────────────────────────────────
  const changePassword = useCallback(
    async (
      current: string,
      newPw: string,
      confirmPw: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not signed in." };
      if (!current || !newPw || !confirmPw) return { success: false, error: "All fields are required." };
      if (newPw.length < 4) return { success: false, error: "New password must be at least 4 characters." };
      if (newPw !== confirmPw) return { success: false, error: "Passwords do not match." };

      const email = usernameToEmail(user.username);
      const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (verifyErr) return { success: false, error: "Current password is incorrect." };

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) return { success: false, error: updateErr.message };

      return { success: true };
    },
    [user],
  );

  // ── resetUserPassword (admin) ──────────────────────────────────────
  const resetUserPassword = useCallback(
    async (username: string, newPw: string): Promise<boolean> => {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, newPassword: newPw }),
      });
      return res.ok;
    },
    [],
  );

  // ── Derived / memoised context value ───────────────────────────────
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      logout,
      isLoggedIn: !!user,
      isSuperAdmin: user?.role === "SUPER_ADMIN",
      isAdmin: user?.role === "ADMIN",
      isBarangayUser: user?.role === "BARANGAY_USER",
      isAdminOrAbove: user?.role === "SUPER_ADMIN" || user?.role === "ADMIN",
      userBarangay: user?.barangay ?? null,
      userRole: user?.role ?? null,
      changePassword,
      resetUserPassword,
      allUsers,
      sessionExpired,
      clearSessionExpired,
      restoreError,
      clearRestoreError,
    }),
    [user, login, logout, changePassword, resetUserPassword, allUsers, sessionExpired, clearSessionExpired, restoreError, clearRestoreError],
  );

  // Pilot hardening: never return `null` from the loading branch — that's
  // what produced the white-screen-on-reload bug. Render a skeleton so the
  // user always sees something while the session restores.
  if (loading) return <AuthLoadingSkeleton />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
