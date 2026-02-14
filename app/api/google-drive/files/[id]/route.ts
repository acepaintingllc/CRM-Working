import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken } from '@/lib/server/googleCalendar'

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export async function GET(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const { orgId, userId } = session
  const params = await Promise.resolve(context.params)
  const id = (params as { id?: string } | null | undefined)?.id
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid file id' }, { status: 400 })
  }

  const origin = new URL(request.url).origin
  const access = await getValidAccessToken({ origin, orgId, userId })
  if ('error' in access) {
    return NextResponse.json({ error: access.error }, { status: 400 })
  }

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${id}`)
  url.searchParams.set('fields', 'id,name,webViewLink')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${access.accessToken}` },
  })
  const json: unknown = await res.json().catch(() => null)
  const obj = asRecord(json)
  if (!res.ok) {
    const err = asRecord(obj?.error)
    const msg =
      (typeof err?.message === 'string' ? err.message : null) ?? 'Failed to fetch file info'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({
    file: {
      id: typeof obj?.id === 'string' ? obj.id : '',
      name: typeof obj?.name === 'string' ? obj.name : '',
      webViewLink: typeof obj?.webViewLink === 'string' ? obj.webViewLink : null,
    },
  })
}
