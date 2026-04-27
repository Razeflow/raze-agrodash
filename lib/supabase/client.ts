"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseUrl, logMissingSupabaseEnv } from "./env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("[Supabase] getSupabaseBrowserClient() must only run in the browser");
  }
  if (!browserClient) {
    const url = getSupabaseUrl();
    const key = getSupabasePublishableKey();
    if (!url || !key) {
      logMissingSupabaseEnv();
    }
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}

/**
 * Lazy proxy so existing `import { supabase } from "@/lib/supabase"` keeps working
 * in Client Components (first touch happens after mount / in handlers).
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseBrowserClient();
    const value = Reflect.get(client as object, prop, receiver);
    if (typeof value === "function") {
      return (value as (...a: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
