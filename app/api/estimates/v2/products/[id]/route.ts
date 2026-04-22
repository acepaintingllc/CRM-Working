import {
  handleEstimateProductRouteDelete,
  handleEstimateProductRoutePatch,
} from '@/lib/server/estimateProductRoutes'

export async function PATCH(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  return handleEstimateProductRoutePatch(request, context)
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  return handleEstimateProductRouteDelete(request, context)
}
