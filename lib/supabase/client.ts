import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ Keep your existing API: supabaseBrowser
// ✅ Make it a singleton to stop "Multiple GoTrueClient instances" during HMR
export const supabaseBrowser =
  (globalThis as any).__ace_supabaseBrowser ??
  ((globalThis as any).__ace_supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }));
