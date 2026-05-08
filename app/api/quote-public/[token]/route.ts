import { resolveParams } from '@/lib/server/apiRoute'
import { serviceResultDataResponse } from '@/lib/server/routeResult'
import { loadPublicEstimatePortalSnapshot } from '@/lib/server/estimatePublicPortal'

export async function GET(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await resolveParams(context)
  const token = (params as { token?: string } | null | undefined)?.token
  return serviceResultDataResponse(
    await loadPublicEstimatePortalSnapshot({
      token: token ?? '',
      origin: new URL(request.url).origin,
      actorType: 'customer',
      metadata: {
        route: 'quote-public',
        user_agent: request.headers.get('user-agent') ?? '',
      },
    })
  )
}
