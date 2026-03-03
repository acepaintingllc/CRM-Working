'use client'

import { supabaseBrowser } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'

function safeNextPath(value: string | null, fallback: string) {
  const next = (value ?? '').trim()
  if (!next) return fallback
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//')) return fallback
  if (next.startsWith('/\\')) return fallback
  return next
}

export default function LoginPage() {
  const supabase = supabaseBrowser
  const searchParams = useSearchParams()

  const signInWithGoogle = async () => {
    const next = safeNextPath(searchParams.get('next'), '/crm')
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
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
