import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken, resolveCalendarId } from '@/lib/server/googleCalendar'
import { readJsonBody } from '@/lib/server/apiRoute'
import { mutationResponse } from '@/lib/server/routeResult'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

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

  const parsed = await readJsonBody<Record<string, unknown>>(request, { maxBytes: 64 * 1024 })
  if (!parsed.ok) return parsed.response
  const body = parsed.value
  const summary = typeof body.summary === 'string' ? body.summary : ''
  const start = typeof body.start === 'string' ? body.start : ''
  const end = typeof body.end === 'string' ? body.end : ''
  if (!summary || !start || !end) {
    return NextResponse.json(
      { error: 'Missing summary, start, or end' },
      { status: 400 }
    )
  }

  const payload = {
    summary,
    description: body.description ? String(body.description) : undefined,
    location: body.location ? String(body.location) : undefined,
    start: { dateTime: start },
    end: { dateTime: end },
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
  const json: unknown = await res.json().catch(() => null)
  const obj = asRecord(json)
  if (!res.ok) {
    const err = asRecord(obj?.error)
    const msg =
      (typeof err?.message === 'string' ? err.message : null) ??
      (typeof obj?.error_description === 'string' ? obj.error_description : null) ??
      'Failed to create event'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return mutationResponse({
    event: {
      id: typeof obj?.id === 'string' ? obj.id : '',
      htmlLink: typeof obj?.htmlLink === 'string' ? obj.htmlLink : null,
    },
  })
}
