/**
 * Minimal layout for the /print route.
 *
 * The root app/layout.tsx already wraps children in <Providers>, which gives
 * us the AgriData + Auth contexts the dashboard components need. We just
 * need a passthrough layout here so Next.js treats /print as its own
 * subtree (no sidebar, no chrome from the live dashboard).
 */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
