import { handlePublicEstimateReadRoute } from '@/lib/server/estimatePublicPortalRoute'

export async function GET(
  request: Request,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  return handlePublicEstimateReadRoute(request, context)
}
