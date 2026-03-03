import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getSessionUserOrg } from '@/lib/server/org'
import { getGoogleOAuthConfig } from '@/lib/server/googleCalendar'

function safeNextPath(value: string | null, fallback: string) {
  const next = (value ?? '').trim()
  if (!next) return fallback
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//')) return fallback
  if (next.startsWith('/\\')) return fallback
  return next
}

export async function GET(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const origin = new URL(request.url).origin
    return NextResponse.redirect(`${origin}/login`)
  }

  const { origin, searchParams } = new URL(request.url)
  const next = safeNextPath(searchParams.get('next'), '/crm/calendar')
  const secure = origin.startsWith('https://')

  let clientId: string
  let redirectUri: string
  try {
    ;({ clientId, redirectUri } = getGoogleOAuthConfig(origin))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Missing Google OAuth env vars'
    const url = new URL(next, origin)
    url.searchParams.set('error', message)
    return NextResponse.redirect(url.toString())
  }

  const state = randomBytes(16).toString('hex')

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('include_granted_scopes', 'true')
  // Calendar + Drive (estimate PDFs + estimate sheets) + Sheets write + Gmail send + Apps Script run.
  // Using broad scopes to avoid "insufficient authentication scopes" errors.
  authUrl.searchParams.set(
    'scope',
    [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/script.projects',
    ].join(' ')
  )
  authUrl.searchParams.set('state', state)

  const res = NextResponse.redirect(authUrl.toString())
  res.cookies.set('gc_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 10 * 60,
  })
  res.cookies.set('gc_next', encodeURIComponent(next), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 10 * 60,
  })
  res.cookies.set('gc_uid', session.userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 10 * 60,
  })
  res.cookies.set('gc_oid', session.orgId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 10 * 60,
  })
  return res
}
