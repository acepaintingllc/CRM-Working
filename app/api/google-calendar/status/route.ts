import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getTokenRow } from '@/lib/server/googleCalendar'

export async function GET() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    return NextResponse.json({ error: session.error }, { status: 401 })
  }

  const { orgId, userId } = session

  try {
    const row = await getTokenRow(orgId, userId)
    return NextResponse.json({ connected: Boolean(row) })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to read calendar connection'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

