import { handleEstimateHomeBootstrapRouteGet } from '@/lib/server/estimateCollectionRoutes'

export async function GET() {
  return handleEstimateHomeBootstrapRouteGet()
}
