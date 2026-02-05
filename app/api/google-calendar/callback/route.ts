import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionUserOrg } from '@/lib/server/org'
import { getGoogleOAuthConfig, getTokenRow, upsertTokenRow } from '@/lib/server/googleCalendar'

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  const cookieStore = await cookies()
  const cookieState = cookieStore.get('gc_state')?.value ?? null
  const cookieNext = cookieStore.get('gc_next')?.value ?? null
  const nextPath = cookieNext ? decodeURIComponent(cookieNext) : '/crm/calendar'

  if (oauthError) {
    return NextResponse.redirect(`${origin}${nextPath}?error=${encodeURIComponent(oauthError)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}${nextPath}?error=missing_code`)
  }

  if (!cookieState || !state || cookieState !== state) {
    return NextResponse.redirect(`${origin}${nextPath}?error=invalid_state`)
  }

  const session = await getSessionUserOrg()
  if ('error' in session) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { orgId, userId } = session
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(origin)

  const form = new URLSearchParams()
  form.set('client_id', clientId)
  form.set('client_secret', clientSecret)
  form.set('grant_type', 'authorization_code')
  form.set('code', code)
  form.set('redirect_uri', redirectUri)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const json: any = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.error_description ?? json?.error ?? 'token_exchange_failed'
    return NextResponse.redirect(`${origin}${nextPath}?error=${encodeURIComponent(msg)}`)
  }

  const existing = await getTokenRow(orgId, userId).catch(() => null)

  const expiresAt = json?.expires_in
    ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
    : null

  await upsertTokenRow({
    orgId,
    userId,
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? existing?.refresh_token ?? null,
    scope: json.scope ?? null,
    token_type: json.token_type ?? null,
    expires_at: expiresAt,
  })

  const response = NextResponse.redirect(`${origin}${nextPath}`)
  response.cookies.set('gc_state', '', { path: '/', maxAge: 0 })
  response.cookies.set('gc_next', '', { path: '/', maxAge: 0 })
  return response
}
