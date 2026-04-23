import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadPublicEstimateWorkflow,
  mockAcceptPublicEstimateWorkflow,
  mockDeclinePublicEstimateWorkflow,
} = vi.hoisted(() => ({
  mockLoadPublicEstimateWorkflow: vi.fn(),
  mockAcceptPublicEstimateWorkflow: vi.fn(),
  mockDeclinePublicEstimateWorkflow: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortalWorkflow', () => ({
  loadPublicEstimateWorkflow: mockLoadPublicEstimateWorkflow,
  acceptPublicEstimateWorkflow: mockAcceptPublicEstimateWorkflow,
  declinePublicEstimateWorkflow: mockDeclinePublicEstimateWorkflow,
  normalizePublicEstimateAcceptanceInput: vi.fn((input: Record<string, unknown>) => ({
    legalName: String(input.legal_name ?? input.full_name ?? '').trim(),
    signatureType: String(input.signature_type ?? 'typed').trim() || 'typed',
    signatureValue: String(input.signature_value ?? input.signature ?? '').trim(),
    acceptedTerms:
      input.accepted_terms === true ||
      input.accepted === true ||
      input.agreement_checked === true,
  })),
}))

import { GET } from '../quote-public/[token]/route'
import { POST as acceptQuote } from '../quote-public/[token]/accept/route'
import { POST as declineQuote } from '../quote-public/[token]/decline/route'

describe('quote public routes', () => {
  beforeEach(() => {
    mockLoadPublicEstimateWorkflow.mockReset()
    mockAcceptPublicEstimateWorkflow.mockReset()
    mockDeclinePublicEstimateWorkflow.mockReset()
  })

  it('returns 400 for invalid token input and 404 for missing public quotes', async () => {
    const invalidResponse = await GET(new Request('http://localhost/api/quote-public/'), {
      params: { token: '' },
    })
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'Invalid token' })

    mockLoadPublicEstimateWorkflow.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Quote not found',
    })
    const missingResponse = await GET(
      new Request('http://localhost/api/quote-public/missing'),
      {
        params: { token: 'missing' },
      }
    )
    expect(mockLoadPublicEstimateWorkflow).toHaveBeenCalledWith({
      token: 'missing',
      origin: 'http://localhost',
      userAgent: '',
    })
    expect(missingResponse.status).toBe(404)
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Quote not found' })
  })

  it('delegates the public read route to the workflow and preserves the snapshot envelope', async () => {
    mockLoadPublicEstimateWorkflow.mockResolvedValue({
      ok: true,
      data: {
        estimate_version_id: 'version-1',
        status: 'sent',
        viewed_at: null,
        public_token: 'token-1',
      },
    })

    const response = await GET(
      new Request('http://localhost/api/quote-public/token-1', {
        headers: { 'user-agent': 'Vitest' },
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(mockLoadPublicEstimateWorkflow).toHaveBeenCalledWith({
      token: 'token-1',
      origin: 'http://localhost',
      userAgent: 'Vitest',
    })
    await expect(response.json()).resolves.toEqual({
      ok: true,
      estimate_version_id: 'version-1',
      status: 'sent',
      viewed_at: null,
      public_token: 'token-1',
    })
  })

  it('accept route normalizes aliases, passes request metadata, and returns the mutation envelope', async () => {
    mockAcceptPublicEstimateWorkflow.mockResolvedValue({
      ok: true,
      data: { id: 'version-1', status: 'accepted' },
    })

    const response = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-agent': 'Vitest',
          'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify({
          full_name: 'Taylor Smith',
          signature: 'Taylor Smith',
          agreement_checked: true,
        }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(mockAcceptPublicEstimateWorkflow).toHaveBeenCalledWith({
      token: 'token-1',
      legalName: 'Taylor Smith',
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      acceptedTerms: true,
      userAgent: 'Vitest',
      ip: '127.0.0.1',
    })
    await expect(response.json()).resolves.toEqual({
      ok: true,
      version: { id: 'version-1', status: 'accepted' },
    })
  })

  it('accept route maps malformed input and workflow conflicts clearly', async () => {
    const malformedResponse = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: '{',
      }),
      {
        params: { token: 'token-1' },
      }
    )
    expect(malformedResponse.status).toBe(400)
    await expect(malformedResponse.json()).resolves.toEqual({
      error: 'Invalid JSON body.',
    })
    expect(mockAcceptPublicEstimateWorkflow).not.toHaveBeenCalled()

    mockAcceptPublicEstimateWorkflow.mockResolvedValue({
      ok: false,
      kind: 'conflict',
      message: 'Cannot accept a declined quote',
    })

    const conflictResponse = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: 'Taylor Smith',
          accepted_terms: true,
        }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(conflictResponse.status).toBe(409)
    await expect(conflictResponse.json()).resolves.toEqual({
      error: 'Cannot accept a declined quote',
    })
  })

  it('decline route delegates to the workflow and maps conflicts', async () => {
    mockDeclinePublicEstimateWorkflow.mockResolvedValueOnce({
      ok: true,
      data: { id: 'version-1', status: 'declined' },
    })

    const response = await declineQuote(
      new Request('http://localhost/api/quote-public/token-1/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Going another direction' }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(mockDeclinePublicEstimateWorkflow).toHaveBeenCalledWith({
      token: 'token-1',
      reason: 'Going another direction',
    })
    await expect(response.json()).resolves.toEqual({
      ok: true,
      version: { id: 'version-1', status: 'declined' },
    })

    mockDeclinePublicEstimateWorkflow.mockResolvedValueOnce({
      ok: false,
      kind: 'conflict',
      message: 'Cannot decline an accepted quote',
    })

    const conflictResponse = await declineQuote(
      new Request('http://localhost/api/quote-public/token-1/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Too late' }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(conflictResponse.status).toBe(409)
    await expect(conflictResponse.json()).resolves.toEqual({
      error: 'Cannot decline an accepted quote',
    })
  })
})
