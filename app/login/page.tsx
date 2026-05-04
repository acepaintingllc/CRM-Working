'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

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
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  function nextPath() {
    const params = new URLSearchParams(window.location.search)
    return safeNextPath(params.get('next'), '/crm')
  }

  const signInWithGoogle = async () => {
    const next = nextPath()
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
      },
    })
  }

  const signInWithPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setPasswordLoading(false)
    if (error) {
      setPasswordError(error.message || 'Unable to sign in with email and password.')
      return
    }

    router.push(nextPath())
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl shadow w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4">
          ACE Painting CRM
        </h1>

        <form onSubmit={signInWithPassword} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-slate-900"
              required
            />
          </label>
          {passwordError ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {passwordError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={passwordLoading}
            className="w-full rounded bg-emerald-700 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {passwordLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs uppercase text-slate-500">
          <div className="h-px flex-1 bg-slate-200" />
          <span>or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          className="w-full bg-black text-white py-2 rounded"
        >
          Continue with Google
        </button>
      </div>
    </main>
  )
}
