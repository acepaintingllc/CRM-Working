import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function safeNextPath(value: string | null, fallback: string) {
  const next = (value ?? '').trim()
  if (!next) return fallback
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//')) return fallback
  if (next.startsWith('/\\')) return fallback
  return next
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNextPath(url.searchParams.get('next'), '/crm')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=oauth&message=${encodeURIComponent(error.message)}`, url.origin)
      )
    }
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
