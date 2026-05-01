import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireSessionUserOrg: vi.fn(),
  readUuidParam: vi.fn(),
  readJsonBody: vi.fn(),
  saveEstimateV2Inputs: vi.fn(),
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

vi.mock('@/lib/server/estimateV2RouteService', () => ({
  EstimateV2RouteServiceError: class EstimateV2RouteServiceError extends Error {
    status: number

    constructor(message: string, status = 400) {
      super(message)
      this.name = 'EstimateV2RouteServiceError'
      this.status = status
    }
  },
  deleteEstimateV2: vi.fn(),
  loadEstimateV2Response: vi.fn(),
  saveEstimateV2Inputs: mocks.saveEstimateV2Inputs,
}))

vi.mock('@/lib/server/estimateCatalogs', () => ({
  getEstimateCatalogs: vi.fn(),
}))

import { handleEstimateRoutePut } from '../estimateResourceRoutes'

const estimateId = '11111111-1111-4111-8111-111111111111'
const request = new Request(`http://localhost/api/estimates/${estimateId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rooms: [] }),
})
const context = { params: { id: estimateId } }

describe('estimate resource routes', () => {
  beforeEach(() => {
    mocks.requireSessionUserOrg.mockReset()
    mocks.readUuidParam.mockReset()
    mocks.readJsonBody.mockReset()
    mocks.saveEstimateV2Inputs.mockReset()

    mocks.requireSessionUserOrg.mockResolvedValue({
      ok: true,
      session: { orgId: 'org-1', userId: 'user-1' },
    })
    mocks.readUuidParam.mockReturnValue({
      ok: true,
      value: estimateId,
    })
    mocks.readJsonBody.mockResolvedValue({
      ok: true,
      value: { rooms: [] },
    })
    mocks.saveEstimateV2Inputs.mockResolvedValue({ ok: true })
  })

  it('allows large estimate V2 save payloads', async () => {
    const response = await handleEstimateRoutePut(request, context)

    expect(mocks.readJsonBody).toHaveBeenCalledWith(request, { maxBytes: 2 * 1024 * 1024 })
    expect(mocks.saveEstimateV2Inputs).toHaveBeenCalledWith({
      requestOrigin: 'http://localhost',
      orgId: 'org-1',
      userId: 'user-1',
      estimateId,
      body: { rooms: [] },
      autosaveOnly: false,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { ok: true } })
  })
})
