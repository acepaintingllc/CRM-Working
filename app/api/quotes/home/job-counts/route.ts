import { handleEstimateHomeJobCountsRouteGet } from '@/lib/server/estimateCollectionRoutes'

export async function GET() {
  return handleEstimateHomeJobCountsRouteGet()
}
