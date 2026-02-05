import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken, resolveCalendarId } from '@/lib/server/googleCalendar'

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null)
  if (!body?.start || !body?.end || !body?.summary) {
    return NextResponse.json(
      { error: 'Missing summary, start, or end' },
      { status: 400 }
    )
  }

  const payload = {
    summary: String(body.summary),
    description: body.description ? String(body.description) : undefined,
    location: body.location ? String(body.location) : undefined,
    start: { dateTime: String(body.start) },
    end: { dateTime: String(body.end) },
  }

  const calendarName =
    (body.calendar_name ? String(body.calendar_name) : null) ??
    process.env.GOOGLE_WORK_CALENDAR_NAME ??
    null

  const calendarId = await resolveCalendarId({
    accessToken: token.accessToken,
    calendarId: body.calendar_id ? String(body.calendar_id) : null,
    calendarName,
  })

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  )
  const json: any = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.error_description ?? 'Failed to create event'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    event: {
      id: json.id,
      htmlLink: json.htmlLink ?? null,
    },
  })
}
