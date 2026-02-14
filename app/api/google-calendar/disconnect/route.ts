import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { deleteTokenRow } from '@/lib/server/googleCalendar'

export async function POST() {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId, userId } = session

  try {
    await deleteTokenRow(orgId, userId)
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to disconnect'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

