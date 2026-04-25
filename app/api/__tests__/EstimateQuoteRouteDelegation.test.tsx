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
  handleEstimateHomeBootstrapRouteGet: vi.fn(),
  handleEstimateHomeJobsRouteGet: vi.fn(),
  handleEstimateHomeSearchRouteGet: vi.fn(),
  handleEstimateJobVersionsRouteGet: vi.fn(),
  handleEstimateQuoteCreateContextRouteGet: vi.fn(),
  handleEstimateProductsRouteGet: vi.fn(),
  handleEstimateProductsRoutePost: vi.fn(),
  handleEstimateProductRoutePatch: vi.fn(),
  handleEstimateProductRouteDelete: vi.fn(),
  loadPublicEstimateSnapshot: vi.fn(),
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
  handleEstimateHomeBootstrapRouteGet: routeHandlerMocks.handleEstimateHomeBootstrapRouteGet,
  handleEstimateHomeJobsRouteGet: routeHandlerMocks.handleEstimateHomeJobsRouteGet,
  handleEstimateHomeSearchRouteGet: routeHandlerMocks.handleEstimateHomeSearchRouteGet,
  handleEstimateJobVersionsRouteGet: routeHandlerMocks.handleEstimateJobVersionsRouteGet,
  handleEstimateQuoteCreateContextRouteGet: routeHandlerMocks.handleEstimateQuoteCreateContextRouteGet,
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

vi.mock('@/lib/server/estimatePublicPortal', () => ({
  loadPublicEstimateSnapshot: routeHandlerMocks.loadPublicEstimateSnapshot,
}))

import { GET as getEstimateCustomerSend, POST as postEstimateCustomerSend, PUT as putEstimateCustomerSend } from '../estimates/[id]/customer-send/route'
import { GET as getEstimatePublic } from '../estimate-public/[token]/route'
import { DELETE as deleteEstimate } from '../estimates/[id]/route'
import { GET as getEstimateVersion, POST as postEstimateVersion } from '../estimates/route'
import { DELETE as deleteEstimateProduct, PATCH as patchEstimateProduct } from '../estimates/v2/products/[id]/route'
import { GET as getEstimateProducts, POST as postEstimateProducts } from '../estimates/v2/products/route'
import { GET as getQuotePublic } from '../quote-public/[token]/route'
import { DELETE as deleteQuote } from '../quotes/[id]/route'
import { GET as getQuoteCustomerSend, POST as postQuoteCustomerSend, PUT as putQuoteCustomerSend } from '../quotes/[id]/customer-send/route'
import { GET as getQuoteHomeBootstrap } from '../quotes/home/bootstrap/route'
import { GET as getQuoteHomeJobs } from '../quotes/home/jobs/route'
import { GET as getQuoteHomeSearch } from '../quotes/home/search/route'
import { GET as getQuoteCreateContext } from '../quotes/home/jobs/[jobId]/create-context/route'
import { GET as getQuoteJobVersions } from '../quotes/home/jobs/[jobId]/versions/route'
import * as quoteProductDetailRoute from '../quotes/products/[id]/route'
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
    routeHandlerMocks.handleEstimateHomeBootstrapRouteGet.mockReset()
    routeHandlerMocks.handleEstimateHomeJobsRouteGet.mockReset()
    routeHandlerMocks.handleEstimateHomeSearchRouteGet.mockReset()
    routeHandlerMocks.handleEstimateJobVersionsRouteGet.mockReset()
    routeHandlerMocks.handleEstimateQuoteCreateContextRouteGet.mockReset()
    routeHandlerMocks.handleEstimateProductsRouteGet.mockReset()
    routeHandlerMocks.handleEstimateProductsRoutePost.mockReset()
    routeHandlerMocks.handleEstimateProductRoutePatch.mockReset()
    routeHandlerMocks.handleEstimateProductRouteDelete.mockReset()
    routeHandlerMocks.loadPublicEstimateSnapshot.mockReset()
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

  it('delegates quote-home focused routes to the shared home handlers', async () => {
    const searchRequest = new Request('http://localhost/api/quotes/home/search?q=kitchen')
    const jobVersionsRequest = new Request(
      'http://localhost/api/quotes/home/jobs/11111111-1111-4111-8111-111111111111/versions'
    )
    const createContextRequest = new Request(
      'http://localhost/api/quotes/home/jobs/11111111-1111-4111-8111-111111111111/create-context'
    )
    const context = {
      params: { jobId: '11111111-1111-4111-8111-111111111111' },
    }

    await getQuoteHomeBootstrap()
    await getQuoteHomeJobs(new Request('http://localhost/api/quotes/home/jobs?q=kitchen'))
    await getQuoteHomeSearch(searchRequest)
    await getQuoteJobVersions(jobVersionsRequest, context)
    await getQuoteCreateContext(createContextRequest, context)

    expect(routeHandlerMocks.handleEstimateHomeBootstrapRouteGet).toHaveBeenCalledWith()
    expect(routeHandlerMocks.handleEstimateHomeJobsRouteGet).toHaveBeenCalled()
    expect(routeHandlerMocks.handleEstimateHomeSearchRouteGet).toHaveBeenCalledWith(searchRequest)
    expect(routeHandlerMocks.handleEstimateJobVersionsRouteGet).toHaveBeenCalledWith(
      jobVersionsRequest,
      context
    )
    expect(routeHandlerMocks.handleEstimateQuoteCreateContextRouteGet).toHaveBeenCalledWith(
      createContextRequest,
      context
    )
  })

  it('delegates estimate product routes and quote product archive/update routes to shared product handlers', async () => {
    const collectionRequest = new Request('http://localhost/api/quotes/products', { method: 'POST' })
    const detailRequest = new Request('http://localhost/api/quotes/products/test', { method: 'PATCH' })
    const context = { params: { id: 'product-1' } }

    await getEstimateProducts(collectionRequest)
    await getQuoteProducts(collectionRequest)
    await postEstimateProducts(collectionRequest)
    await postQuoteProducts(collectionRequest)
    await patchEstimateProduct(detailRequest, context)
    await quoteProductDetailRoute.PATCH(detailRequest, context)
    await deleteEstimateProduct(detailRequest, context)

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
    expect(routeHandlerMocks.handleEstimateProductRouteDelete).toHaveBeenCalledTimes(1)
    expect(quoteProductDetailRoute).not.toHaveProperty('DELETE')
  })

  it('delegates estimate and quote public read routes to the shared estimate portal service', async () => {
    routeHandlerMocks.loadPublicEstimateSnapshot.mockResolvedValue({
      ok: true,
      data: {
        estimate_version_id: 'version-1',
        status: 'viewed',
        viewed_at: '2026-04-01T00:00:00.000Z',
        public_token: 'token-1',
      },
    })

    const estimateRequest = new Request('http://localhost/api/estimate-public/token-1', {
      headers: { 'user-agent': 'Vitest' },
    })
    const quoteRequest = new Request('http://localhost/api/quote-public/token-1', {
      headers: { 'user-agent': 'Vitest' },
    })
    const context = { params: { token: 'token-1' } }

    const estimateResponse = await getEstimatePublic(estimateRequest, context)
    const quoteResponse = await getQuotePublic(quoteRequest, context)

    expect(routeHandlerMocks.loadPublicEstimateSnapshot).toHaveBeenNthCalledWith(
      1,
      'token-1',
      { origin: 'http://localhost' },
      { metadata: { user_agent: 'Vitest' } }
    )
    expect(routeHandlerMocks.loadPublicEstimateSnapshot).toHaveBeenNthCalledWith(
      2,
      'token-1',
      { origin: 'http://localhost' },
      { metadata: { user_agent: 'Vitest' } }
    )
    await expect(estimateResponse.json()).resolves.toEqual({
      data: {
        estimate_version_id: 'version-1',
        status: 'viewed',
        viewed_at: '2026-04-01T00:00:00.000Z',
        public_token: 'token-1',
      },
    })
    await expect(quoteResponse.json()).resolves.toEqual({
      data: {
        estimate_version_id: 'version-1',
        status: 'viewed',
        viewed_at: '2026-04-01T00:00:00.000Z',
        public_token: 'token-1',
      },
    })
  })
})
