import { handleEstimateHomeJobsRouteGet } from '@/lib/server/estimateCollectionRoutes'

export async function GET(request: Request) {
  return handleEstimateHomeJobsRouteGet(request)
}
