import {
  estimateCustomerSendCopy,
  handleEstimateCustomerSendRouteGet,
  handleEstimateCustomerSendRoutePost,
  handleEstimateCustomerSendRoutePut,
} from '@/lib/server/estimateCustomerSendRoute'

export async function GET(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  return handleEstimateCustomerSendRouteGet(request, context)
}

export async function PUT(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  return handleEstimateCustomerSendRoutePut(request, context)
}

export async function POST(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  return handleEstimateCustomerSendRoutePost(request, context, estimateCustomerSendCopy)
}
