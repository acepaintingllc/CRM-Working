import {
  handleEstimateCollectionRouteGet,
  handleEstimateCollectionRoutePost,
  quoteEstimateCollectionCopy,
} from '@/lib/server/estimateCollectionRoutes'

export async function GET() {
  return handleEstimateCollectionRouteGet()
}

export async function POST(request: Request) {
  return handleEstimateCollectionRoutePost(request, quoteEstimateCollectionCopy)
}
