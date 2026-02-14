import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken } from '@/lib/server/googleCalendar'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function monthRange(month: string) {
  // month: YYYY-MM
  const [y, m] = month.split('-').map((v) => Number(v))
  if (!y || !m || m < 1 || m > 12) return null
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0))
  return { timeMin: start.toISOString(), timeMax: end.toISOString() }
}

export async function GET(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { origin } = new URL(request.url)
  const { orgId, userId } = session

  const token = await getValidAccessToken({ origin, orgId, userId })
  if ('error' in token) {
    return NextResponse.json({ error: token.error }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM
  const range = month ? monthRange(month) : null
  const timeMin = range?.timeMin ?? new Date().toISOString()
  const timeMax = range?.timeMax ?? undefined

  const calendarIdsParam = searchParams.get('calendar_ids') ?? 'primary'
  const calendarIds = calendarIdsParam
    .split(',')
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean)
    .slice(0, 10)

  const fetchOne = async (calendarId: string) => {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    )
    url.searchParams.set('maxResults', '250')
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')
    url.searchParams.set('timeMin', timeMin)
    if (timeMax) url.searchParams.set('timeMax', timeMax)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    })
    const json: unknown = await res.json().catch(() => null)
    const obj = asRecord(json)
    if (!res.ok) {
      const err = asRecord(obj?.error)
      const msg =
        (typeof err?.message === 'string' ? err.message : null) ??
        (typeof obj?.error_description === 'string' ? obj.error_description : null) ??
        'Failed to fetch events'
      throw new Error(msg)
    }

    const items = Array.isArray(obj?.items) ? obj.items : []
    return items.map((entry) => {
      const e = asRecord(entry)
      const start = asRecord(e?.start)
      const end = asRecord(e?.end)
      return {
      id: typeof e?.id === 'string' ? e.id : '',
      calendarId,
      summary: typeof e?.summary === 'string' ? e.summary : null,
      start:
        (typeof start?.dateTime === 'string' ? start.dateTime : null) ??
        (typeof start?.date === 'string' ? start.date : null),
      end:
        (typeof end?.dateTime === 'string' ? end.dateTime : null) ??
        (typeof end?.date === 'string' ? end.date : null),
      htmlLink: typeof e?.htmlLink === 'string' ? e.htmlLink : null,
    }})
  }

  try {
    const lists = await Promise.all(calendarIds.map((id) => fetchOne(id)))
    const events = lists.flat()
    return NextResponse.json({ events, timeMin, timeMax: timeMax ?? null })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to fetch events'
    return NextResponse.json(
      {
        error:
          message +
          '. If you just enabled Calendar, disconnect and reconnect Google to grant the new scope.',
      },
      { status: 500 }
    )
  }
}
