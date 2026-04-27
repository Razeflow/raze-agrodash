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
  login: (username: string, password: string) => Promise<true | string>;
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

// ── Constants ─────────────────────────────────────────────────────────

const STORAGE_KEY = "agridash-auth-user";

// ── Context ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ────────────────────────────────────────────────────────────

/** Build a SUPER_ADMIN profile for the given username. */
function makeProfile(username: string): UserProfile {
  return {
    id: `local-${username.toLowerCase()}`,
    username: username.toLowerCase(),
    displayName: username,
    role: "SUPER_ADMIN",
    barangay: null,
  };
}

/** Read stored profile from localStorage (returns null if absent/invalid). */
function readStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

// ── Provider ───────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Session restoration on mount ──────────────────────────────────
  useEffect(() => {
    const stored = readStoredUser();
    setUser(stored);
    setLoading(false);
  }, []);

  // ── Derived allUsers list (just the current user if logged in) ────
  const allUsers = useMemo<
    { username: string; displayName: string; role: UserRole; barangay: string | null }[]
  >(() => {
    if (!user) return [];
    return [
      {
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        barangay: user.barangay,
      },
    ];
  }, [user]);

  // ── login ──────────────────────────────────────────────────────────
  const login = useCallback(
    async (username: string, _password: string): Promise<true | string> => {
      const profile = makeProfile(username);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      setUser(profile);
      return true;
    },
    [],
  );

  // ── logout ─────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  // ── changePassword (no-op) ─────────────────────────────────────────
  const changePassword = useCallback(
    async (
      _current: string,
      _newPw: string,
      _confirmPw: string,
    ): Promise<{ success: boolean; error?: string }> => {
      return { success: true };
    },
    [],
  );

  // ── resetUserPassword (no-op) ──────────────────────────────────────
  const resetUserPassword = useCallback(
    async (_username: string, _newPw: string): Promise<boolean> => {
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

  if (loading) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
