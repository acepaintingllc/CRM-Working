import { NextResponse } from 'next/server'
import { getEstimateCatalogs } from '@/lib/server/estimateCatalogs'
import { getSessionUserOrg } from '@/lib/server/org'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await getSessionUserOrg()
  if ('error' in session) {
    const status = session.error === 'Not authenticated' ? 401 : 403
    return NextResponse.json({ error: session.error }, { status })
  }

  const params = await Promise.resolve(context.params)
  const id = (params as { id?: Unsafe } | null | undefined)?.id
  if (!id || typeof id !== 'string' || !uuid.test(id)) {
    return NextResponse.json({ error: 'Invalid estimate id' }, { status: 400 })
  }

  try {
    const refresh = new URL(request.url).searchParams.get('refresh') === '1'
    const catalogs = await getEstimateCatalogs({
      origin: new URL(request.url).origin,
      orgId: session.orgId,
      userId: session.userId,
      estimateId: id,
      forceRefresh: refresh,
    })
    return NextResponse.json(catalogs)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load estimate catalogs'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
