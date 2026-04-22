import {
  handleEstimateRouteDelete,
  handleEstimateRouteGet,
  handleEstimateRoutePut,
  type EstimateRouteContext,
} from '@/lib/server/estimateResourceRoutes'

export async function GET(request: Request, context: EstimateRouteContext) {
  return handleEstimateRouteGet(request, context)
}

export async function PUT(request: Request, context: EstimateRouteContext) {
  return handleEstimateRoutePut(request, context)
}

export async function DELETE(_request: Request, context: EstimateRouteContext) {
  return handleEstimateRouteDelete(_request, context, { deletedNotice: 'Estimate deleted.' })
}
