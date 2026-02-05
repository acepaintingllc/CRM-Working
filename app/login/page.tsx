'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = supabaseBrowser
  const [remember, setRemember] = useState(true)

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=/crm&remember=${remember ? '1' : '0'}`,
      },
    })
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">
          ACE Painting CRM
        </h1>

        <label className="flex items-center gap-2 text-sm mb-4">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Stay logged in on this device
        </label>

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
