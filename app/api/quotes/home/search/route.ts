import { handleEstimateHomeSearchRouteGet } from '@/lib/server/estimateCollectionRoutes'

export async function GET(request: Request) {
  return handleEstimateHomeSearchRouteGet(request)
}
