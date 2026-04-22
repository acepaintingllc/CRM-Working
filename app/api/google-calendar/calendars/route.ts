import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken, listCalendars } from '@/lib/server/googleCalendar'
import { dataResponse } from '@/lib/server/routeResult'

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

  try {
    const calendars = await listCalendars(token.accessToken)
    return dataResponse(calendars)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to list calendars'
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
