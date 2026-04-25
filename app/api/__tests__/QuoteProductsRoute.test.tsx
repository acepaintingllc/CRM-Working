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

  it('preserves canonical product auth, read, write, and error envelopes', async () => {
    routeHandlerMocks.handleEstimateProductsRouteGet
      .mockResolvedValueOnce(Response.json({ error: 'Not authenticated' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ data: [{ id: 'product-1' }] }))
    routeHandlerMocks.handleEstimateProductsRoutePost
      .mockResolvedValueOnce(
        Response.json({ data: { id: 'product-2' }, notice: 'Product created.' })
      )
      .mockResolvedValueOnce(Response.json({ error: 'Product name is required.' }, { status: 400 }))

    const request = new Request('http://localhost/api/quotes/products')

    const authResponse = await GET(request)
    expect(authResponse.status).toBe(401)
    await expect(authResponse.json()).resolves.toEqual({ error: 'Not authenticated' })

    await expect((await GET(request)).json()).resolves.toEqual({
      data: [{ id: 'product-1' }],
    })
    await expect((await POST(request)).json()).resolves.toEqual({
      data: { id: 'product-2' },
      notice: 'Product created.',
    })

    const errorResponse = await POST(request)
    expect(errorResponse.status).toBe(400)
    await expect(errorResponse.json()).resolves.toEqual({
      error: 'Product name is required.',
    })
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

  it('preserves product detail auth and validation errors from the canonical handler', async () => {
    routeHandlerMocks.handleEstimateProductRoutePatch
      .mockResolvedValueOnce(Response.json({ error: 'Not authenticated' }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ error: 'Invalid product id' }, { status: 400 }))

    const request = new Request('http://localhost/api/quotes/products/not-a-uuid')
    const context = { params: { id: 'not-a-uuid' } }

    const authResponse = await quoteProductDetailRoute.PATCH(request, context)
    expect(authResponse.status).toBe(401)
    await expect(authResponse.json()).resolves.toEqual({ error: 'Not authenticated' })

    const validationResponse = await quoteProductDetailRoute.PATCH(request, context)
    expect(validationResponse.status).toBe(400)
    await expect(validationResponse.json()).resolves.toEqual({ error: 'Invalid product id' })
  })

  it('does not expose quote product DELETE as a supported lifecycle action', () => {
    expect(quoteProductDetailRoute).not.toHaveProperty('DELETE')
  })
})
