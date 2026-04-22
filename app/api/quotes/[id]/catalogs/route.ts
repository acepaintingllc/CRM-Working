import {
  handleEstimateCatalogsRouteGet,
  type EstimateRouteContext,
} from '@/lib/server/estimateResourceRoutes'

export async function GET(request: Request, context: EstimateRouteContext) {
  return handleEstimateCatalogsRouteGet(request, context)
}
