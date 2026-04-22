import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeHandlerMocks = vi.hoisted(() => ({
  handleEstimateProductsRouteGet: vi.fn(),
  handleEstimateProductsRoutePost: vi.fn(),
  handleEstimateProductRoutePatch: vi.fn(),
  handleEstimateProductRouteDelete: vi.fn(),
}))

vi.mock('@/lib/server/estimateProductRoutes', () => ({
  handleEstimateProductsRouteGet: routeHandlerMocks.handleEstimateProductsRouteGet,
  handleEstimateProductsRoutePost: routeHandlerMocks.handleEstimateProductsRoutePost,
  handleEstimateProductRoutePatch: routeHandlerMocks.handleEstimateProductRoutePatch,
  handleEstimateProductRouteDelete: routeHandlerMocks.handleEstimateProductRouteDelete,
}))

import { GET, POST } from '../quotes/products/route'
import { DELETE, PATCH } from '../quotes/products/[id]/route'

describe('quote product route wrappers', () => {
  beforeEach(() => {
    routeHandlerMocks.handleEstimateProductsRouteGet.mockReset()
    routeHandlerMocks.handleEstimateProductsRoutePost.mockReset()
    routeHandlerMocks.handleEstimateProductRoutePatch.mockReset()
    routeHandlerMocks.handleEstimateProductRouteDelete.mockReset()
  })

  it('delegates collection routes to the canonical estimate product handlers', async () => {
    const request = new Request('http://localhost/api/quotes/products')

    await GET(request)
    await POST(request)

    expect(routeHandlerMocks.handleEstimateProductsRouteGet).toHaveBeenCalledWith(request)
    expect(routeHandlerMocks.handleEstimateProductsRoutePost).toHaveBeenCalledWith(request)
  })

  it('delegates detail routes to the canonical estimate product handlers', async () => {
    const request = new Request('http://localhost/api/quotes/products/test')
    const context = { params: { id: 'product-1' } }

    await PATCH(request, context)
    await DELETE(request, context)

    expect(routeHandlerMocks.handleEstimateProductRoutePatch).toHaveBeenCalledWith(
      request,
      context
    )
    expect(routeHandlerMocks.handleEstimateProductRouteDelete).toHaveBeenCalledWith(
      request,
      context
    )
  })
})
