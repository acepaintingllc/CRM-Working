import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getTokenRow } from '@/lib/server/googleCalendar'

export async function GET(request: Request) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    return NextResponse.json({ error: session.error }, { status: 401 })
  }

  const { orgId, userId } = session

  try {
    const row = await getTokenRow(orgId, userId)
    return NextResponse.json({ connected: Boolean(row) })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Failed to read calendar connection' },
      { status: 500 }
    )
  }
}

