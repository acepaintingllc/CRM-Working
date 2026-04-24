import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeHandlerMocks = vi.hoisted(() => ({
  handleEstimateProductsRouteGet: vi.fn(),
  handleEstimateProductsRoutePost: vi.fn(),
  handleEstimateProductRoutePatch: vi.fn(),
}))

vi.mock('@/lib/server/estimateProductRoutes', () => ({
  handleEstimateProductsRouteGet: routeHandlerMocks.handleEstimateProductsRouteGet,
  handleEstimateProductsRoutePost: routeHandlerMocks.handleEstimateProductsRoutePost,
  handleEstimateProductRoutePatch: routeHandlerMocks.handleEstimateProductRoutePatch,
}))

import { GET, POST } from '../quotes/products/route'
import * as quoteProductDetailRoute from '../quotes/products/[id]/route'

describe('quote product route wrappers', () => {
  beforeEach(() => {
    routeHandlerMocks.handleEstimateProductsRouteGet.mockReset()
    routeHandlerMocks.handleEstimateProductsRoutePost.mockReset()
    routeHandlerMocks.handleEstimateProductRoutePatch.mockReset()
  })

  it('delegates collection routes to the canonical estimate product handlers', async () => {
    const request = new Request('http://localhost/api/quotes/products')

    await GET(request)
    await POST(request)

    expect(routeHandlerMocks.handleEstimateProductsRouteGet).toHaveBeenCalledWith(request)
    expect(routeHandlerMocks.handleEstimateProductsRoutePost).toHaveBeenCalledWith(request)
  })

  it('delegates product detail PATCH to the canonical estimate product handler', async () => {
    const request = new Request('http://localhost/api/quotes/products/test')
    const context = { params: { id: 'product-1' } }

    await quoteProductDetailRoute.PATCH(request, context)

    expect(routeHandlerMocks.handleEstimateProductRoutePatch).toHaveBeenCalledWith(
      request,
      context
    )
  })

  it('does not expose quote product DELETE as a supported lifecycle action', () => {
    expect(quoteProductDetailRoute).not.toHaveProperty('DELETE')
  })
})
