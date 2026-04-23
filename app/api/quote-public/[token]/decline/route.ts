import { handlePublicEstimateDeclineRoute } from '@/lib/server/estimatePublicPortalRoute'

export async function POST(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  return handlePublicEstimateDeclineRoute(request, context)
}
