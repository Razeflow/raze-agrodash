import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[Supabase] Missing environment variables! NEXT_PUBLIC_SUPABASE_URL=" +
      (supabaseUrl ? "SET" : "MISSING") +
      ", NEXT_PUBLIC_SUPABASE_ANON_KEY=" +
      (supabaseAnonKey ? "SET" : "MISSING"),
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
