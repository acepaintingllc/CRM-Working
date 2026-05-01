import { supabaseAdmin } from './org.ts'

type TokenRow = {
  access_token: string
  refresh_token: string | null
  expires_at: string | null
  scope: string | null
  token_type: string | null
}

type GoogleCalendarListItem = {
  id?: unknown
  summary?: unknown
  summaryOverride?: unknown
  primary?: unknown
  backgroundColor?: unknown
  foregroundColor?: unknown
  selected?: unknown
}

type GoogleOAuthTokenResponse = {
  access_token?: unknown
  refresh_token?: unknown
  expires_in?: unknown
  scope?: unknown
  token_type?: unknown
  error?: unknown
  error_description?: unknown
  items?: unknown
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

export function getGoogleOAuthConfig(origin: string) {
  const clientId = requireEnv('GOOGLE_CLIENT_ID')
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET')
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? `${origin}/api/google-calendar/callback`
  return { clientId, clientSecret, redirectUri }
}

export async function listCalendars(accessToken: string) {
  const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList')
  url.searchParams.set('minAccessRole', 'reader')
  url.searchParams.set('showHidden', 'false')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const json: GoogleOAuthTokenResponse = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = asRecord(json.error)
    const msg =
      (typeof err?.message === 'string' ? err.message : null) ??
      (typeof json.error_description === 'string' ? json.error_description : null) ??
      'Failed to list calendars'
    throw new Error(msg)
  }

  const rawItems = Array.isArray(json.items) ? (json.items as GoogleCalendarListItem[]) : []
  const items = rawItems.map((c) => ({
    id: typeof c.id === 'string' ? c.id : '',
    summary:
      typeof c.summary === 'string'
        ? c.summary
        : typeof c.summaryOverride === 'string'
          ? c.summaryOverride
          : null,
    primary: Boolean(c.primary),
    backgroundColor: typeof c.backgroundColor === 'string' ? c.backgroundColor : null,
    foregroundColor: typeof c.foregroundColor === 'string' ? c.foregroundColor : null,
    selected: Boolean(c.selected),
  }))

  return items as {
    id: string
    summary: string | null
    primary: boolean
    backgroundColor: string | null
    foregroundColor: string | null
    selected: boolean
  }[]
}

export async function resolveCalendarId(params: {
  accessToken: string
  calendarId?: string | null
  calendarName?: string | null
}) {
  if (params.calendarId) return params.calendarId

  const calendars = await listCalendars(params.accessToken)
  const name = params.calendarName?.trim()
  if (name) {
    const found = calendars.find((c) => (c.summary ?? '').toLowerCase() === name.toLowerCase())
    if (found) return found.id
  }

  const primary = calendars.find((c) => c.primary) ?? calendars[0]
  if (!primary) throw new Error('No calendars available')
  return primary.id
}

export async function getTokenRow(orgId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, expires_at, scope, token_type')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return (data as TokenRow | null) ?? null
}

export async function upsertTokenRow(params: {
  orgId: string
  userId: string
  access_token: string
  refresh_token: string | null
  scope: string | null
  token_type: string | null
  expires_at: string | null
}) {
  const { error } = await supabaseAdmin
    .from('google_calendar_tokens')
    .upsert(
      {
        org_id: params.orgId,
        user_id: params.userId,
        access_token: params.access_token,
        refresh_token: params.refresh_token,
        scope: params.scope,
        token_type: params.token_type,
        expires_at: params.expires_at,
      },
      { onConflict: 'org_id,user_id' }
    )

  if (error) throw error
}

export async function deleteTokenRow(orgId: string, userId: string) {
  const { error } = await supabaseAdmin
    .from('google_calendar_tokens')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId)
  if (error) throw error
}

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  const t = new Date(expiresAt).getTime()
  if (Number.isNaN(t)) return false
  // refresh 2 minutes early
  return t - Date.now() < 2 * 60 * 1000
}

export async function refreshAccessToken(params: {
  origin: string
  orgId: string
  userId: string
  refreshToken: string
}) {
  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig(params.origin)

  const form = new URLSearchParams()
  form.set('client_id', clientId)
  form.set('client_secret', clientSecret)
  form.set('grant_type', 'refresh_token')
  form.set('refresh_token', params.refreshToken)
  form.set('redirect_uri', redirectUri)

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const json: GoogleOAuthTokenResponse = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err =
      typeof json.error_description === 'string'
        ? json.error_description
        : typeof json.error === 'string'
          ? json.error
          : 'Failed to refresh token'
    throw new Error(err)
  }

  const expiresAt =
    json.expires_in != null
      ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
    : null

  const accessToken = typeof json.access_token === 'string' ? json.access_token : null
  if (!accessToken) throw new Error('Google token response missing access_token')

  await upsertTokenRow({
    orgId: params.orgId,
    userId: params.userId,
    access_token: accessToken,
    // keep refresh token unchanged on refresh flows
    refresh_token: params.refreshToken,
    scope: typeof json.scope === 'string' ? json.scope : null,
    token_type: typeof json.token_type === 'string' ? json.token_type : null,
    expires_at: expiresAt,
  })

  return accessToken
}

export async function getValidAccessToken(params: {
  origin: string
  orgId: string
  userId: string
}) {
  const row = await getTokenRow(params.orgId, params.userId)
  if (!row) return { error: 'Not connected' as const }

  if (!isExpired(row.expires_at)) {
    return { accessToken: row.access_token } as const
  }

  if (!row.refresh_token) {
    return { error: 'Google refresh token missing. Reconnect Google Calendar.' as const }
  }

  const accessToken = await refreshAccessToken({
    origin: params.origin,
    orgId: params.orgId,
    userId: params.userId,
    refreshToken: row.refresh_token,
  })
  return { accessToken } as const
}
