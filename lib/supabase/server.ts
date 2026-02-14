import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

type SupabaseServerClientOptions = {
  remember?: boolean
}

type CookieStore = {
  getAll?: () => {
    name: string
    value: string
    options?: Record<string, unknown>
  }[]
  set?: (name: string, value: string, options?: Record<string, unknown>) => void
}

export async function createSupabaseServerClient(
  options: SupabaseServerClientOptions = {}
) {
  // Works whether cookies() is sync or async
  const cookieStore = (await Promise.resolve(cookies())) as unknown as CookieStore

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Some Next versions use getAll(), others are always present once awaited
          return typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : []
        },
        setAll(cookiesToSet) {
          if (typeof cookieStore.set !== 'function') return
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            const nextOptions = { ...cookieOptions }

            if (options.remember === false) {
              // Session-only cookies when "stay logged in" is unchecked.
              delete nextOptions.maxAge
              delete nextOptions.expires
            }

            cookieStore.set(name, value, nextOptions)
          }
        },
      },
    }
  )
}
