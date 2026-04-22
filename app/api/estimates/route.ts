import {
  estimateCollectionCopy,
  handleEstimateCollectionRouteGet,
  handleEstimateCollectionRoutePost,
} from '@/lib/server/estimateCollectionRoutes'

export async function GET() {
  return handleEstimateCollectionRouteGet()
}

export async function POST(request: Request) {
  return handleEstimateCollectionRoutePost(request, estimateCollectionCopy)
}
