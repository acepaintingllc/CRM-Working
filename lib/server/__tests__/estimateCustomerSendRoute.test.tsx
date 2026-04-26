import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSessionUserOrg: vi.fn(),
  readUuidParam: vi.fn(),
  readJsonBody: vi.fn(),
  loadEstimateCustomerSendContext: vi.fn(),
  buildCustomerSendPageData: vi.fn(),
  saveCustomerSendDraftMutation: vi.fn(),
  submitCustomerSendMutation: vi.fn(),
  checkLocalRateLimit: vi.fn(),
}))

vi.mock('@/lib/server/apiRoute', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/apiRoute')>()
  return {
    ...actual,
    requireSessionUserOrg: mocks.requireSessionUserOrg,
    readUuidParam: mocks.readUuidParam,
    readJsonBody: mocks.readJsonBody,
    resolveParams: (context: { params: unknown }) => Promise.resolve(context.params),
  }
})

vi.mock('@/lib/server/estimateCustomerPortal', () => ({
  loadEstimateCustomerSendContext: mocks.loadEstimateCustomerSendContext,
}))

vi.mock('@/lib/server/customer-send/service', () => ({
  buildCustomerSendPageData: mocks.buildCustomerSendPageData,
  saveCustomerSendDraftMutation: mocks.saveCustomerSendDraftMutation,
  submitCustomerSendMutation: mocks.submitCustomerSendMutation,
}))

vi.mock('@/lib/server/rateLimit', () => ({
  checkLocalRateLimit: mocks.checkLocalRateLimit,
}))

import {
  estimateCustomerSendCopy,
  handleEstimateCustomerSendRouteGet,
  handleEstimateCustomerSendRoutePost,
  handleEstimateCustomerSendRoutePut,
} from '../estimateCustomerSendRoute'

const request = new Request('http://localhost/api/estimates/estimate-1/customer-send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'send', draft: { title: 'Kitchen Quote' } }),
})

const context = { params: { id: '11111111-1111-4111-8111-111111111111' } }

const loadedContext = {
  estimate: { id: 'estimate-1' },
  public_versions: [],
} as never

describe('estimateCustomerSendRoute', () => {
  beforeEach(() => {
    mocks.requireSessionUserOrg.mockReset()
    mocks.readUuidParam.mockReset()
    mocks.readJsonBody.mockReset()
    mocks.loadEstimateCustomerSendContext.mockReset()
    mocks.buildCustomerSendPageData.mockReset()
    mocks.saveCustomerSendDraftMutation.mockReset()
    mocks.submitCustomerSendMutation.mockReset()
    mocks.checkLocalRateLimit.mockReset()

    mocks.requireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mocks.readUuidParam.mockReturnValue({
      ok: true,
      value: 'estimate-1',
    })
    mocks.readJsonBody.mockResolvedValue({
      ok: true,
      value: { mode: 'send', draft: { title: 'Kitchen Quote' } },
    })
    mocks.loadEstimateCustomerSendContext.mockResolvedValue(loadedContext)
    mocks.buildCustomerSendPageData.mockReturnValue({
      ok: true,
      data: { public_url: null, document: { meta: { title: 'Kitchen Quote' } } },
    })
    mocks.saveCustomerSendDraftMutation.mockResolvedValue({
      ok: true,
      data: { public_url: 'https://example.test/quote/token', version: { status: 'draft' } },
    })
    mocks.submitCustomerSendMutation.mockResolvedValue({
      ok: true,
      data: { public_url: 'https://example.test/quote/token', version: { status: 'sent' } },
    })
    mocks.checkLocalRateLimit.mockReturnValue({ ok: true })
  })

  it('returns { data } for GET success', async () => {
    const response = await handleEstimateCustomerSendRouteGet(request, context)

    expect(mocks.loadEstimateCustomerSendContext).toHaveBeenCalledWith({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
    })
    expect(mocks.buildCustomerSendPageData).toHaveBeenCalledWith({
      origin: 'http://localhost',
      context: loadedContext,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { public_url: null, document: { meta: { title: 'Kitchen Quote' } } },
    })
  })

  it('returns { data, notice } for PUT success', async () => {
    const response = await handleEstimateCustomerSendRoutePut(
      new Request('http://localhost/api/estimates/estimate-1/customer-send', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: { title: 'Kitchen Quote' } }),
      }),
      context
    )

    expect(mocks.readJsonBody).toHaveBeenCalled()
    expect(mocks.saveCustomerSendDraftMutation).toHaveBeenCalledWith({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: { mode: 'send', draft: { title: 'Kitchen Quote' } },
      context: loadedContext,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { public_url: 'https://example.test/quote/token', version: { status: 'draft' } },
      notice: 'Draft saved.',
    })
  })

  it('returns test-send notice for POST test mode success', async () => {
    mocks.readJsonBody.mockResolvedValueOnce({
      ok: true,
      value: { mode: 'test', draft: { title: 'Kitchen Quote' } },
    })
    mocks.submitCustomerSendMutation.mockResolvedValueOnce({
      ok: true,
      data: { public_url: null, version: { status: 'draft' } },
    })

    const response = await handleEstimateCustomerSendRoutePost(request, context, estimateCustomerSendCopy)

    expect(mocks.readJsonBody).toHaveBeenCalledWith(request, { allowEmpty: true })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { public_url: null, version: { status: 'draft' } },
      notice: 'Test message sent.',
    })
  })

  it('returns copy send notice for live POST success', async () => {
    const response = await handleEstimateCustomerSendRoutePost(request, context, estimateCustomerSendCopy)

    expect(mocks.checkLocalRateLimit).toHaveBeenCalledWith({
      key: 'customer-send:org-1:user-1:estimate-1',
      max: 5,
      windowMs: 10 * 60 * 1000,
    })
    expect(mocks.submitCustomerSendMutation).toHaveBeenCalledWith({
      origin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId: 'estimate-1',
      body: { mode: 'send', draft: { title: 'Kitchen Quote' } },
      context: loadedContext,
      copy: estimateCustomerSendCopy,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      data: { public_url: 'https://example.test/quote/token', version: { status: 'sent' } },
      notice: 'Estimate sent.',
    })
  })

  it('returns 429 when customer-send rate limit is exceeded', async () => {
    mocks.checkLocalRateLimit.mockReturnValueOnce({ ok: false })

    const response = await handleEstimateCustomerSendRoutePost(request, context, estimateCustomerSendCopy)

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      error: 'Too many send attempts. Please wait and retry.',
    })
    expect(mocks.submitCustomerSendMutation).not.toHaveBeenCalled()
  })

  it('short-circuits on auth failure', async () => {
    const authResponse = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    mocks.requireSessionUserOrg.mockResolvedValueOnce({
      ok: false,
      response: authResponse,
    })

    const response = await handleEstimateCustomerSendRouteGet(request, context)

    expect(response).toBe(authResponse)
    expect(mocks.loadEstimateCustomerSendContext).not.toHaveBeenCalled()
  })

  it('preserves invalid estimate id responses', async () => {
    const invalidIdResponse = new Response(JSON.stringify({ error: 'Invalid estimate id' }), { status: 400 })
    mocks.readUuidParam.mockReturnValueOnce({
      ok: false,
      response: invalidIdResponse,
    })

    const response = await handleEstimateCustomerSendRouteGet(request, context)

    expect(response).toBe(invalidIdResponse)
    expect(mocks.loadEstimateCustomerSendContext).not.toHaveBeenCalled()
  })

  it('preserves invalid JSON body responses for PUT and POST', async () => {
    const invalidBodyResponse = new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
    mocks.readJsonBody.mockResolvedValueOnce({
      ok: false,
      response: invalidBodyResponse,
    })

    const putResponse = await handleEstimateCustomerSendRoutePut(request, context)
    expect(putResponse).toBe(invalidBodyResponse)

    mocks.readJsonBody.mockResolvedValueOnce({
      ok: false,
      response: invalidBodyResponse,
    })
    const postResponse = await handleEstimateCustomerSendRoutePost(request, context, estimateCustomerSendCopy)
    expect(postResponse).toBe(invalidBodyResponse)
  })

  it('maps missing context to 404 { error }', async () => {
    mocks.loadEstimateCustomerSendContext.mockResolvedValueOnce({ error: 'Quote not found' })

    const response = await handleEstimateCustomerSendRouteGet(request, context)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: 'Quote not found' })
  })

  it('maps service invalid_input and server_error results to shared error envelopes', async () => {
    mocks.buildCustomerSendPageData.mockReturnValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Broken draft',
    })
    const getResponse = await handleEstimateCustomerSendRouteGet(request, context)
    expect(getResponse.status).toBe(400)
    await expect(getResponse.json()).resolves.toEqual({ error: 'Broken draft' })

    mocks.saveCustomerSendDraftMutation.mockResolvedValueOnce({
      ok: false,
      kind: 'server_error',
      message: 'Save exploded',
    })
    const putResponse = await handleEstimateCustomerSendRoutePut(request, context)
    expect(putResponse.status).toBe(500)
    await expect(putResponse.json()).resolves.toEqual({ error: 'Save exploded' })

    mocks.submitCustomerSendMutation.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Customer email is required',
    })
    const postResponse = await handleEstimateCustomerSendRoutePost(request, context, estimateCustomerSendCopy)
    expect(postResponse.status).toBe(400)
    await expect(postResponse.json()).resolves.toEqual({ error: 'Customer email is required' })
  })
})
