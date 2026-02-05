'use client'

import { supabaseBrowser } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = supabaseBrowser

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/crm`,
      },
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">
          ACE Painting CRM
        </h1>

        <button
          onClick={signInWithGoogle}
          className="w-full bg-black text-white py-2 rounded"
        >
          Continue with Google
        </button>
      </div>
    </main>
  )
}
