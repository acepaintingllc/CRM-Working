import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type BrowserClient = ReturnType<typeof createBrowserClient>;

declare global {
  var __ace_supabaseBrowser: BrowserClient | undefined;
}

// Keep existing API: `supabaseBrowser`.
// Singleton avoids duplicate GoTrue clients during HMR.
export const supabaseBrowser =
  globalThis.__ace_supabaseBrowser ??
  (globalThis.__ace_supabaseBrowser = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  }));
