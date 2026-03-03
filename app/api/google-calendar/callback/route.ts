import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSessionUserOrg } from '@/lib/server/org'
import { getGoogleOAuthConfig, getTokenRow, upsertTokenRow } from '@/lib/server/googleCalendar'

function safeNextPath(value: string | null, fallback: string) {
  const next = (value ?? '').trim()
  if (!next) return fallback
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//')) return fallback
  if (next.startsWith('/\\')) return fallback
  return next
}

type TokenResponse = {
  error_description?: unknown
  error?: unknown
  expires_in?: unknown
  access_token?: unknown
  refresh_token?: unknown
  scope?: unknown
  token_type?: unknown
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')
  const secure = origin.startsWith('https://')

  const cookieStore = await cookies()
  const cookieState = cookieStore.get('gc_state')?.value ?? null
  const cookieNext = cookieStore.get('gc_next')?.value ?? null
  const cookieUserId = cookieStore.get('gc_uid')?.value ?? null
  const cookieOrgId = cookieStore.get('gc_oid')?.value ?? null
  let decodedNext: string | null = null
  if (cookieNext) {
    try {
      decodedNext = decodeURIComponent(cookieNext)
    } catch {
      decodedNext = null
    }
  }
  const nextPath = safeNextPath(decodedNext, '/crm/calendar')

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
  const orgId = 'error' in session ? cookieOrgId : session.orgId
  const userId = 'error' in session ? cookieUserId : session.userId
  if (!orgId || !userId) {
    return NextResponse.redirect(`${origin}/login`)
  }
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
  const json: TokenResponse = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof json.error_description === 'string'
        ? json.error_description
        : typeof json.error === 'string'
          ? json.error
          : 'token_exchange_failed'
    return NextResponse.redirect(`${origin}${nextPath}?error=${encodeURIComponent(msg)}`)
  }

  const existing = await getTokenRow(orgId, userId).catch(() => null)

  const expiresAt = json.expires_in != null
    ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
    : null

  const accessToken = typeof json.access_token === 'string' ? json.access_token : null
  if (!accessToken) {
    return NextResponse.redirect(`${origin}${nextPath}?error=${encodeURIComponent('token_exchange_failed')}`)
  }

  await upsertTokenRow({
    orgId,
    userId,
    access_token: accessToken,
    refresh_token:
      typeof json.refresh_token === 'string' ? json.refresh_token : existing?.refresh_token ?? null,
    scope: typeof json.scope === 'string' ? json.scope : null,
    token_type: typeof json.token_type === 'string' ? json.token_type : null,
    expires_at: expiresAt,
  })

  const response = NextResponse.redirect(`${origin}${nextPath}`)
  response.cookies.set('gc_state', '', { path: '/', maxAge: 0, secure, sameSite: 'lax' })
  response.cookies.set('gc_next', '', { path: '/', maxAge: 0, secure, sameSite: 'lax' })
  response.cookies.set('gc_uid', '', { path: '/', maxAge: 0, secure, sameSite: 'lax' })
  response.cookies.set('gc_oid', '', { path: '/', maxAge: 0, secure, sameSite: 'lax' })
  return response
}
