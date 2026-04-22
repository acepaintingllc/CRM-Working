import { NextResponse } from 'next/server'
import { loadPublicEstimateByToken, markPublicEstimateViewed } from '@/lib/server/estimatePublicPortal'

export async function GET(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await Promise.resolve(context.params)
  const token = (params as { token?: string } | null | undefined)?.token
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const loaded = await loadPublicEstimateByToken(token, new URL(request.url).origin)
  if ('error' in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: 404 })
  }

  if ((loaded.snapshot.status === 'sent' || loaded.snapshot.status === 'viewed') && !loaded.snapshot.viewed_at) {
    await markPublicEstimateViewed({
      versionId: loaded.snapshot.estimate_version_id,
      orgId: (loaded.version.org_id as string) ?? '',
      metadata: {
        user_agent: request.headers.get('user-agent') ?? '',
      },
    })
  }

  return NextResponse.json({ ok: true, ...loaded.snapshot })
}
