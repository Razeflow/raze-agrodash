"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase";

// ── Types (exported so downstream can import) ──────────────────────────

export type UserRole = "SUPER_ADMIN" | "ADMIN" | "BARANGAY_USER";

export type UserProfile = {
  id: string;
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
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (
    current: string,
    newPw: string,
    confirmPw: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resetUserPassword: (username: string, newPw: string) => Promise<boolean>;
  allUsers: {
    username: string;
    displayName: string;
    role: UserRole;
    barangay: string | null;
  }[];
};

// ── Context ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ────────────────────────────────────────────────────────────

/** Convert a plain username to the email we store in Supabase Auth. */
function usernameToEmail(username: string): string {
  return `${username.toLowerCase()}@agridash.local`;
}

/** Fetch a user profile row from the `profiles` table by Supabase auth id. */
async function fetchProfileById(
  authId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, role, barangay")
    .eq("id", authId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    role: data.role as UserRole,
    barangay: data.barangay ?? null,
  };
}

/** Fetch every profile (for the allUsers list). */
async function fetchAllProfiles(): Promise<
  { username: string; displayName: string; role: UserRole; barangay: string | null }[]
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username, display_name, role, barangay");

  if (error || !data) return [];

  return data.map((row) => ({
    username: row.username,
    displayName: row.display_name,
    role: row.role as UserRole,
    barangay: row.barangay ?? null,
  }));
}

// ── Provider ───────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<
    { username: string; displayName: string; role: UserRole; barangay: string | null }[]
  >([]);

  // ── Session restoration + auth state listener ──────────────────────
  useEffect(() => {
    let mounted = true;

    // 1. Check for an existing session on mount
    async function restoreSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          const profile = await fetchProfileById(session.user.id);
          if (mounted) setUser(profile);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    restoreSession();

    // 2. Subscribe to auth changes (token refresh, sign-out from another tab, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        return;
      }

      // SIGNED_IN, TOKEN_REFRESHED, etc.
      const profile = await fetchProfileById(session.user.id);
      if (mounted) setUser(profile);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ── Fetch all users (for admin panels) — refetch after login ───────
  useEffect(() => {
    if (user) {
      fetchAllProfiles().then(setAllUsers);
    } else {
      setAllUsers([]);
    }
  }, [user]);

  // ── login ──────────────────────────────────────────────────────────
  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      const email = usernameToEmail(username);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) return false;

      const profile = await fetchProfileById(data.user.id);
      if (!profile) return false;

      setUser(profile);
      return true;
    },
    [],
  );

  // ── logout ─────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    supabase.auth.signOut();
    setUser(null);
  }, []);

  // ── changePassword ─────────────────────────────────────────────────
  const changePassword = useCallback(
    async (
      current: string,
      newPw: string,
      confirmPw: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not logged in." };

      if (newPw.length < 4) {
        return { success: false, error: "New password must be at least 4 characters." };
      }
      if (newPw !== confirmPw) {
        return { success: false, error: "New passwords do not match." };
      }

      // Verify the current password by re-authenticating
      const email = usernameToEmail(user.username);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });

      if (signInError) {
        return { success: false, error: "Current password is incorrect." };
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPw,
      });

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      return { success: true };
    },
    [user],
  );

  // ── resetUserPassword ──────────────────────────────────────────────
  const resetUserPassword = useCallback(
    async (_username: string, _newPw: string): Promise<boolean> => {
      // Requires service_role key (server-side only).
      // Not available in the browser client — will be implemented via
      // a Supabase Edge Function in a future version.
      console.warn(
        "resetUserPassword is not available in this version. Contact the system administrator.",
      );
      return false;
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
    }),
    [user, login, logout, changePassword, resetUserPassword, allUsers],
  );

  // While the session check is in-flight, render children with user=null
  // so the login page can still display.
  if (loading) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
