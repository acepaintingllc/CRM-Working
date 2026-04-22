import {
  handleEstimateProductsRouteGet,
  handleEstimateProductsRoutePost,
} from '@/lib/server/estimateProductRoutes'

export async function GET() {
  return handleEstimateProductsRouteGet()
}

export async function POST(request: Request) {
  return handleEstimateProductsRoutePost(request)
}
