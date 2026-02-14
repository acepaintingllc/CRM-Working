import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type BrowserClient = ReturnType<typeof createClient>;

declare global {
  var __ace_supabaseBrowser: BrowserClient | undefined;
}

// Keep existing API: `supabaseBrowser`.
// Singleton avoids duplicate GoTrue clients during HMR.
export const supabaseBrowser =
  globalThis.__ace_supabaseBrowser ??
  (globalThis.__ace_supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }));
