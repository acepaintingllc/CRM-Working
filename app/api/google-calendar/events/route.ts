import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken } from '@/lib/server/googleCalendar'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function monthRange(month: string) {
  // month: YYYY-MM
  const [year, monthNumber] = month.split('-').map((v) => Number(v))
  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) return null
  const start = new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(year, monthNumber, 1, 0, 0, 0))
  return { timeMin: start.toISOString(), timeMax: end.toISOString() }
}

function readIntParam(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = raw ? Number(raw) : fallback
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.floor(parsed)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

function parseEventSortTime(start: string | null) {
  if (!start) return Number.MAX_SAFE_INTEGER
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    const [year, month, day] = start.split('-').map((part) => Number(part))
    return new Date(year, month - 1, day).getTime()
  }
  const parsed = new Date(start).getTime()
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
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

  const limit = readIntParam(searchParams.get('limit'), 20, 1, 250)
  const days = readIntParam(searchParams.get('days'), 30, 1, 90)

  const now = new Date()
  const timeMin = range?.timeMin ?? now.toISOString()
  const timeMax =
    range?.timeMax ??
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()

  const calendarIdsParam = searchParams.get('calendar_ids') ?? 'primary'
  const calendarIds = calendarIdsParam
    .split(',')
    .map((value) => decodeURIComponent(value.trim()))
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
      const message =
        (typeof err?.message === 'string' ? err.message : null) ??
        (typeof obj?.error_description === 'string' ? obj.error_description : null) ??
        'Failed to fetch events'
      throw new Error(message)
    }

    const items = Array.isArray(obj?.items) ? obj.items : []
    return items.map((entry) => {
      const event = asRecord(entry)
      const start = asRecord(event?.start)
      const end = asRecord(event?.end)
      return {
        id: typeof event?.id === 'string' ? event.id : '',
        calendarId,
        summary: typeof event?.summary === 'string' ? event.summary : null,
        start:
          (typeof start?.dateTime === 'string' ? start.dateTime : null) ??
          (typeof start?.date === 'string' ? start.date : null),
        end:
          (typeof end?.dateTime === 'string' ? end.dateTime : null) ??
          (typeof end?.date === 'string' ? end.date : null),
        htmlLink: typeof event?.htmlLink === 'string' ? event.htmlLink : null,
      }
    })
  }

  try {
    const eventLists = await Promise.all(calendarIds.map((calendarId) => fetchOne(calendarId)))
    const events = eventLists
      .flat()
      .sort((a, b) => parseEventSortTime(a.start) - parseEventSortTime(b.start))
      .slice(0, limit)
    return NextResponse.json({ events, timeMin, timeMax })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch events'
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
