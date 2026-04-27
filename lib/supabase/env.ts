/** Supabase project URL (browser + server + middleware). */
export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

/**
 * Public client key: legacy anon JWT or newer publishable key.
 * Prefer ANON_KEY when both are set for backward compatibility.
 */
export function getSupabasePublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ""
  );
}

export function logMissingSupabaseEnv(): void {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    console.error(
      "[Supabase] Missing env: NEXT_PUBLIC_SUPABASE_URL=" +
        (url ? "SET" : "MISSING") +
        ", NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=" +
        (key ? "SET" : "MISSING"),
    );
  }
}
