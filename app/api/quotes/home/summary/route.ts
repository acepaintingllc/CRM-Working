import { handleEstimateHomeSummaryRouteGet } from '@/lib/server/estimateCollectionRoutes'

export async function GET() {
  return handleEstimateHomeSummaryRouteGet()
}
