import { NextResponse } from 'next/server'
import { serviceResultDataResponse } from '@/lib/server/routeResult'
import { loadPublicEstimateSnapshot } from '@/lib/server/estimatePublicPortal'

export async function GET(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await Promise.resolve(context.params)
  const token = (params as { token?: string } | null | undefined)?.token
  return serviceResultDataResponse(
    await loadPublicEstimateSnapshot(
      token ?? '',
      { origin: new URL(request.url).origin },
      {
        metadata: {
          user_agent: request.headers.get('user-agent') ?? '',
        },
      }
    )
  )
}
