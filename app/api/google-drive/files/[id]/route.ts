import { NextResponse } from 'next/server'
import { getSessionUserOrg } from '@/lib/server/org'
import { getValidAccessToken } from '@/lib/server/googleCalendar'

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
  const id = (params as any)?.id
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
  const json: any = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = json?.error?.message ?? 'Failed to fetch file info'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  return NextResponse.json({
    file: {
      id: json?.id as string,
      name: json?.name as string,
      webViewLink: (json?.webViewLink as string | null) ?? null,
    },
  })
}
