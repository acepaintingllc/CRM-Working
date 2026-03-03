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

function buildConnectResponse(params: {
  origin: string
  next: string
  userId: string
  orgId: string
  asJson: boolean
}) {
  const { origin, next, userId, orgId, asJson } = params
  const secure = origin.startsWith('https://')

  let clientId: string
  let redirectUri: string
  try {
    ;({ clientId, redirectUri } = getGoogleOAuthConfig(origin))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Missing Google OAuth env vars'
    if (asJson) {
      return NextResponse.json({ error: message }, { status: 500 })
    }
    const errorUrl = new URL(next, origin)
    errorUrl.searchParams.set('error', message)
    return NextResponse.redirect(errorUrl.toString())
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

  const res = asJson
    ? NextResponse.json({ url: authUrl.toString() })
    : NextResponse.redirect(authUrl.toString())
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
  res.cookies.set('gc_uid', userId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 10 * 60,
  })
  res.cookies.set('gc_oid', orgId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 10 * 60,
  })
  return res
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const next = safeNextPath(searchParams.get('next'), '/crm/calendar')
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const loginUrl = new URL('/login', origin)
    loginUrl.searchParams.set('next', `/api/google-calendar/connect?next=${encodeURIComponent(next)}`)
    return NextResponse.redirect(loginUrl.toString())
  }

  return buildConnectResponse({
    origin,
    next,
    userId: session.userId,
    orgId: session.orgId,
    asJson: false,
  })
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url)
  const body = await request.json().catch(() => null)
  const next = safeNextPath(typeof body?.next === 'string' ? body.next : null, '/crm/calendar')
  const session = await getSessionUserOrg()
  if ('error' in session) {
    return NextResponse.json({ error: session.error }, { status: 401 })
  }

  return buildConnectResponse({
    origin,
    next,
    userId: session.userId,
    orgId: session.orgId,
    asJson: true,
  })
}
