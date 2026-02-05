import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken } from '@/lib/server/googleCalendar'

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
    const json: any = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = json?.error?.message ?? json?.error_description ?? 'Failed to fetch events'
      throw new Error(msg)
    }

    return (json?.items ?? []).map((e: any) => ({
      id: e.id,
      calendarId,
      summary: e.summary ?? null,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      htmlLink: e.htmlLink ?? null,
    }))
  }

  try {
    const lists = await Promise.all(calendarIds.map((id) => fetchOne(id)))
    const events = lists.flat()
    return NextResponse.json({ events, timeMin, timeMax: timeMax ?? null })
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          (e?.message ?? 'Failed to fetch events') +
          '. If you just enabled Calendar, disconnect and reconnect Google to grant the new scope.',
      },
      { status: 500 }
    )
  }
}
