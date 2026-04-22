import { beforeEach, describe, expect, it, vi } from 'vitest'

const routeHandlerMocks = vi.hoisted(() => ({
  handleEstimateRouteDelete: vi.fn(),
  handleEstimateRouteGet: vi.fn(),
  handleEstimateRoutePut: vi.fn(),
  handleEstimateCustomerSendRouteGet: vi.fn(),
  handleEstimateCustomerSendRoutePut: vi.fn(),
  handleEstimateCustomerSendRoutePost: vi.fn(),
  handleEstimateCollectionRouteGet: vi.fn(),
  handleEstimateCollectionRoutePost: vi.fn(),
  handleEstimateProductsRouteGet: vi.fn(),
  handleEstimateProductsRoutePost: vi.fn(),
  handleEstimateProductRoutePatch: vi.fn(),
  handleEstimateProductRouteDelete: vi.fn(),
}))

vi.mock('@/lib/server/estimateResourceRoutes', () => ({
  handleEstimateRouteDelete: routeHandlerMocks.handleEstimateRouteDelete,
  handleEstimateRouteGet: routeHandlerMocks.handleEstimateRouteGet,
  handleEstimateRoutePut: routeHandlerMocks.handleEstimateRoutePut,
}))

vi.mock('@/lib/server/estimateCustomerSendRoute', () => ({
  handleEstimateCustomerSendRouteGet: routeHandlerMocks.handleEstimateCustomerSendRouteGet,
  handleEstimateCustomerSendRoutePut: routeHandlerMocks.handleEstimateCustomerSendRoutePut,
  handleEstimateCustomerSendRoutePost: routeHandlerMocks.handleEstimateCustomerSendRoutePost,
  estimateCustomerSendCopy: {
    sendNotice: 'Estimate sent.',
    sendFailureMessage: 'Unable to send estimate',
    lockFailureMessage: 'Unable to lock estimate',
  },
  quoteCustomerSendCopy: {
    sendNotice: 'Quote sent.',
    sendFailureMessage: 'Unable to send quote',
    lockFailureMessage: 'Unable to lock quote',
  },
}))

vi.mock('@/lib/server/estimateCollectionRoutes', () => ({
  handleEstimateCollectionRouteGet: routeHandlerMocks.handleEstimateCollectionRouteGet,
  handleEstimateCollectionRoutePost: routeHandlerMocks.handleEstimateCollectionRoutePost,
  estimateCollectionCopy: {
    createdNotice: 'Estimate version created.',
    defaultVersionName: (value: number) => `Estimate Version ${value + 1}`,
  },
  quoteEstimateCollectionCopy: {
    createdNotice: 'Quote version created.',
    defaultVersionName: (value: number) => `Quote Version ${value + 1}`,
  },
}))

vi.mock('@/lib/server/estimateProductRoutes', () => ({
  handleEstimateProductsRouteGet: routeHandlerMocks.handleEstimateProductsRouteGet,
  handleEstimateProductsRoutePost: routeHandlerMocks.handleEstimateProductsRoutePost,
  handleEstimateProductRoutePatch: routeHandlerMocks.handleEstimateProductRoutePatch,
  handleEstimateProductRouteDelete: routeHandlerMocks.handleEstimateProductRouteDelete,
}))

import { GET as getEstimateCustomerSend, POST as postEstimateCustomerSend, PUT as putEstimateCustomerSend } from '../estimates/[id]/customer-send/route'
import { DELETE as deleteEstimate } from '../estimates/[id]/route'
import { GET as getEstimateVersion, POST as postEstimateVersion } from '../estimates/route'
import { DELETE as deleteEstimateProduct, PATCH as patchEstimateProduct } from '../estimates/v2/products/[id]/route'
import { GET as getEstimateProducts, POST as postEstimateProducts } from '../estimates/v2/products/route'
import { DELETE as deleteQuote } from '../quotes/[id]/route'
import { GET as getQuoteCustomerSend, POST as postQuoteCustomerSend, PUT as putQuoteCustomerSend } from '../quotes/[id]/customer-send/route'
import { DELETE as deleteQuoteProduct, PATCH as patchQuoteProduct } from '../quotes/products/[id]/route'
import { GET as getQuoteProducts, POST as postQuoteProducts } from '../quotes/products/route'
import { GET as getQuoteVersion, POST as postQuoteVersion } from '../quotes/route'

describe('estimate and quote route delegation', () => {
  beforeEach(() => {
    routeHandlerMocks.handleEstimateRouteDelete.mockReset()
    routeHandlerMocks.handleEstimateCustomerSendRouteGet.mockReset()
    routeHandlerMocks.handleEstimateCustomerSendRoutePut.mockReset()
    routeHandlerMocks.handleEstimateCustomerSendRoutePost.mockReset()
    routeHandlerMocks.handleEstimateCollectionRouteGet.mockReset()
    routeHandlerMocks.handleEstimateCollectionRoutePost.mockReset()
    routeHandlerMocks.handleEstimateProductsRouteGet.mockReset()
    routeHandlerMocks.handleEstimateProductsRoutePost.mockReset()
    routeHandlerMocks.handleEstimateProductRoutePatch.mockReset()
    routeHandlerMocks.handleEstimateProductRouteDelete.mockReset()
  })

  it('delegates delete routes to the shared estimate resource handler with family-specific notices', async () => {
    const request = new Request('http://localhost/api/estimates/test', { method: 'DELETE' })
    const context = { params: { id: 'estimate-1' } }

    await deleteEstimate(request, context)
    await deleteQuote(request, context)

    expect(routeHandlerMocks.handleEstimateRouteDelete).toHaveBeenNthCalledWith(
      1,
      request,
      context,
      expect.objectContaining({ deletedNotice: 'Estimate deleted.' })
    )
    expect(routeHandlerMocks.handleEstimateRouteDelete).toHaveBeenNthCalledWith(
      2,
      request,
      context,
      expect.objectContaining({ deletedNotice: 'Quote deleted.' })
    )
  })

  it('delegates customer send routes to the shared handler with only copy differences', async () => {
    const request = new Request('http://localhost/api/quotes/test', { method: 'POST' })
    const context = { params: { id: 'estimate-1' } }

    await getEstimateCustomerSend(request, context)
    await getQuoteCustomerSend(request, context)
    await putEstimateCustomerSend(request, context)
    await putQuoteCustomerSend(request, context)
    await postEstimateCustomerSend(request, context)
    await postQuoteCustomerSend(request, context)

    expect(routeHandlerMocks.handleEstimateCustomerSendRouteGet).toHaveBeenNthCalledWith(
      1,
      request,
      context
    )
    expect(routeHandlerMocks.handleEstimateCustomerSendRouteGet).toHaveBeenNthCalledWith(
      2,
      request,
      context
    )
    expect(routeHandlerMocks.handleEstimateCustomerSendRoutePut).toHaveBeenNthCalledWith(
      1,
      request,
      context
    )
    expect(routeHandlerMocks.handleEstimateCustomerSendRoutePut).toHaveBeenNthCalledWith(
      2,
      request,
      context
    )
    expect(routeHandlerMocks.handleEstimateCustomerSendRoutePost).toHaveBeenNthCalledWith(
      1,
      request,
      context,
      expect.objectContaining({ sendNotice: 'Estimate sent.' })
    )
    expect(routeHandlerMocks.handleEstimateCustomerSendRoutePost).toHaveBeenNthCalledWith(
      2,
      request,
      context,
      expect.objectContaining({ sendNotice: 'Quote sent.' })
    )
  })

  it('delegates version creation routes to the shared collection handler with family-specific defaults', async () => {
    const request = new Request('http://localhost/api/quotes', { method: 'POST' })

    await getEstimateVersion()
    await getQuoteVersion()
    await postEstimateVersion(request)
    await postQuoteVersion(request)

    expect(routeHandlerMocks.handleEstimateCollectionRouteGet).toHaveBeenNthCalledWith(1)
    expect(routeHandlerMocks.handleEstimateCollectionRouteGet).toHaveBeenNthCalledWith(2)
    expect(routeHandlerMocks.handleEstimateCollectionRoutePost).toHaveBeenNthCalledWith(
      1,
      request,
      expect.objectContaining({ createdNotice: 'Estimate version created.' })
    )
    expect(routeHandlerMocks.handleEstimateCollectionRoutePost).toHaveBeenNthCalledWith(
      2,
      request,
      expect.objectContaining({ createdNotice: 'Quote version created.' })
    )
  })

  it('delegates estimate and quote product routes to the shared product handlers', async () => {
    const collectionRequest = new Request('http://localhost/api/quotes/products', { method: 'POST' })
    const detailRequest = new Request('http://localhost/api/quotes/products/test', { method: 'PATCH' })
    const context = { params: { id: 'product-1' } }

    await getEstimateProducts(collectionRequest)
    await getQuoteProducts(collectionRequest)
    await postEstimateProducts(collectionRequest)
    await postQuoteProducts(collectionRequest)
    await patchEstimateProduct(detailRequest, context)
    await patchQuoteProduct(detailRequest, context)
    await deleteEstimateProduct(detailRequest, context)
    await deleteQuoteProduct(detailRequest, context)

    expect(routeHandlerMocks.handleEstimateProductsRouteGet).toHaveBeenNthCalledWith(1, collectionRequest)
    expect(routeHandlerMocks.handleEstimateProductsRouteGet).toHaveBeenNthCalledWith(2, collectionRequest)
    expect(routeHandlerMocks.handleEstimateProductsRoutePost).toHaveBeenNthCalledWith(1, collectionRequest)
    expect(routeHandlerMocks.handleEstimateProductsRoutePost).toHaveBeenNthCalledWith(2, collectionRequest)
    expect(routeHandlerMocks.handleEstimateProductRoutePatch).toHaveBeenNthCalledWith(
      1,
      detailRequest,
      context
    )
    expect(routeHandlerMocks.handleEstimateProductRoutePatch).toHaveBeenNthCalledWith(
      2,
      detailRequest,
      context
    )
    expect(routeHandlerMocks.handleEstimateProductRouteDelete).toHaveBeenNthCalledWith(
      1,
      detailRequest,
      context
    )
    expect(routeHandlerMocks.handleEstimateProductRouteDelete).toHaveBeenNthCalledWith(
      2,
      detailRequest,
      context
    )
  })
})
