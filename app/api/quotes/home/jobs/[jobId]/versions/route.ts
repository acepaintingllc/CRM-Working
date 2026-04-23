import {
  handleEstimateJobVersionsRouteGet,
  type EstimateJobVersionsRouteContext,
} from '@/lib/server/estimateCollectionRoutes'

export async function GET(request: Request, context: EstimateJobVersionsRouteContext) {
  return handleEstimateJobVersionsRouteGet(request, context)
}
