import {
  handleEstimateQuoteCreateContextRouteGet,
  type EstimateQuoteCreateContextRouteContext,
} from '@/lib/server/estimateCollectionRoutes'

export async function GET(request: Request, context: EstimateQuoteCreateContextRouteContext) {
  return handleEstimateQuoteCreateContextRouteGet(request, context)
}
