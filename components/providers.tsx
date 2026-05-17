"use client";
import { AuthProvider } from "@/lib/auth-context";
import { AgriDataProvider } from "@/lib/agri-context";
import ErrorBoundary from "@/components/ErrorBoundary";

/**
 * Root client-provider tree. Each provider gets its own ErrorBoundary so a
 * crash inside `AgriDataProvider` (or anything below it) doesn't kill the
 * AuthProvider too — the user still sees a recoverable UI with the ability
 * to sign out. Without isolation, a single render throw anywhere under
 * `<AuthProvider>` would unmount the entire tree and white-screen the app.
 *
 * The outer boundary catches errors that escape AuthProvider itself (rare;
 * AuthProvider has its own try/catch in the session-restore effect).
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary label="AuthProvider">
      <AuthProvider>
        <ErrorBoundary label="AgriDataProvider">
          <AgriDataProvider>{children}</AgriDataProvider>
        </ErrorBoundary>
      </AuthProvider>
    </ErrorBoundary>
  );
}
