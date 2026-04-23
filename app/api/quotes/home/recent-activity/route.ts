import { handleEstimateHomeRecentActivityRouteGet } from '@/lib/server/estimateCollectionRoutes'

export async function GET() {
  return handleEstimateHomeRecentActivityRouteGet()
}
