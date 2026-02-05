import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/crm'
  const rememberParam = url.searchParams.get('remember')
  const remember =
    rememberParam === null ? undefined : rememberParam === '1' || rememberParam === 'true'

  if (code) {
    const supabase = await createSupabaseServerClient({ remember })
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=oauth&message=${encodeURIComponent(error.message)}`, url.origin)
      )
    }
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
