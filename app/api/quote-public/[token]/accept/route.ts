import { handlePublicEstimateAcceptRoute } from '@/lib/server/estimatePublicPortalRoute'

export async function POST(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  return handlePublicEstimateAcceptRoute(request, context)
}
