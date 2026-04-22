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

import { DELETE as deleteEstimate } from '../estimates/[id]/route'
import { DELETE as deleteQuote } from '../quotes/[id]/route'
import { POST as postEstimateCustomerSend } from '../estimates/[id]/customer-send/route'
import { POST as postQuoteCustomerSend } from '../quotes/[id]/customer-send/route'
import { POST as postEstimateVersion } from '../estimates/route'
import { POST as postQuoteVersion } from '../quotes/route'

describe('estimate and quote route delegation', () => {
  beforeEach(() => {
    routeHandlerMocks.handleEstimateRouteDelete.mockReset()
    routeHandlerMocks.handleEstimateCustomerSendRoutePost.mockReset()
    routeHandlerMocks.handleEstimateCollectionRoutePost.mockReset()
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

    await postEstimateCustomerSend(request, context)
    await postQuoteCustomerSend(request, context)

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

    await postEstimateVersion(request)
    await postQuoteVersion(request)

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
})
