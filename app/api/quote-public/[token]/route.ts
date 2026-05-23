import { resolveParams } from '@/lib/server/apiRoute'
import { serviceResultDataResponse } from '@/lib/server/routeResult'
import { loadPublicEstimatePortalSnapshot } from '@/lib/server/estimatePublicPortal'
import { checkLocalRateLimit } from '@/lib/server/rateLimit'

export async function GET(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const params = await resolveParams(context)
  const token = (params as { token?: string } | null | undefined)?.token

  // In-memory rate limit — best-effort on serverless (resets per instance)
  const rate = checkLocalRateLimit({ key: `quote-public:get:${token ?? ''}`, max: 60, windowMs: 60_000 })
  if (!rate.ok) {
    return Response.json(
      { error: 'Too many requests. Please wait and retry.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } }
    )
  }

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
