import {
  handleEstimateProductsRouteGet,
  handleEstimateProductsRoutePost,
} from '@/lib/server/estimateProductRoutes'

export async function GET(request: Request) {
  return handleEstimateProductsRouteGet(request)
}

export async function POST(request: Request) {
  return handleEstimateProductsRoutePost(request)
}
