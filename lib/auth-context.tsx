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
import { supabase } from "@/lib/supabase/client";

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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);

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
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        if (!cancelled) setUser(profile);
      }
      if (!cancelled) setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
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
      return true;
    },
    [fetchProfile],
  );

  // ── logout ─────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAllUsers([]);
  }, []);

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
    }),
    [user, login, logout, changePassword, resetUserPassword, allUsers],
  );

  if (loading) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
