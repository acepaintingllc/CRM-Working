import { handleEstimateHomeRouteGet } from '@/lib/server/estimateCollectionRoutes'

export async function GET() {
  return handleEstimateHomeRouteGet()
}
