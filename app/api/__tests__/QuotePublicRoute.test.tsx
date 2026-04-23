import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLoadPublicEstimateSnapshot,
  mockAcceptPublicEstimate,
  mockDeclinePublicEstimate,
} = vi.hoisted(() => ({
  mockLoadPublicEstimateSnapshot: vi.fn(),
  mockAcceptPublicEstimate: vi.fn(),
  mockDeclinePublicEstimate: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortal', () => ({
  loadPublicEstimateSnapshot: mockLoadPublicEstimateSnapshot,
  acceptPublicEstimate: mockAcceptPublicEstimate,
  declinePublicEstimate: mockDeclinePublicEstimate,
}))

import { GET } from '../quote-public/[token]/route'
import { POST as acceptQuote } from '../quote-public/[token]/accept/route'
import { POST as declineQuote } from '../quote-public/[token]/decline/route'

describe('quote public routes', () => {
  beforeEach(() => {
    mockLoadPublicEstimateSnapshot.mockReset()
    mockAcceptPublicEstimate.mockReset()
    mockDeclinePublicEstimate.mockReset()
  })

  it('returns 400 for invalid token input and 404 for missing public quotes', async () => {
    mockLoadPublicEstimateSnapshot.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid token',
    })
    const invalidResponse = await GET(new Request('http://localhost/api/quote-public/'), {
      params: { token: '' },
    })
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({ error: 'Invalid token' })

    mockLoadPublicEstimateSnapshot.mockResolvedValue({
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
    expect(mockLoadPublicEstimateSnapshot).toHaveBeenCalledWith(
      'missing',
      { origin: 'http://localhost' },
      { metadata: { user_agent: '' } }
    )
    expect(missingResponse.status).toBe(404)
    await expect(missingResponse.json()).resolves.toEqual({ error: 'Quote not found' })
  })

  it('marks the first eligible public view as viewed and returns the snapshot payload', async () => {
    mockLoadPublicEstimateSnapshot.mockResolvedValue({
      ok: true,
      data: {
        estimate_version_id: 'version-1',
        status: 'viewed',
        viewed_at: '2026-04-01T00:00:00.000Z',
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

    expect(mockLoadPublicEstimateSnapshot).toHaveBeenCalledWith(
      'token-1',
      { origin: 'http://localhost' },
      { metadata: { user_agent: 'Vitest' } }
    )
    await expect(response.json()).resolves.toEqual({
      data: {
        estimate_version_id: 'version-1',
        status: 'viewed',
        viewed_at: '2026-04-01T00:00:00.000Z',
        public_token: 'token-1',
      },
    })
  })

  it('accept route validates required fields and writes acceptance metadata', async () => {
    mockAcceptPublicEstimate.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Legal name is required',
    })

    const invalidResponse = await acceptQuote(
      new Request('http://localhost/api/quote-public/token-1/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted_terms: true }),
      }),
      {
        params: { token: 'token-1' },
      }
    )
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toEqual({
      error: 'Legal name is required',
    })

    mockAcceptPublicEstimate.mockResolvedValue({
      ok: true,
      data: { estimate_version_id: 'version-1', status: 'accepted' },
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
          legal_name: 'Taylor Smith',
          accepted_terms: true,
          signature_type: 'typed',
          signature_value: 'Taylor Smith',
        }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(mockAcceptPublicEstimate).toHaveBeenCalledWith({
      token: 'token-1',
      legalName: 'Taylor Smith',
      signatureType: 'typed',
      signatureValue: 'Taylor Smith',
      acceptedTerms: true,
      userAgent: 'Vitest',
      ip: '127.0.0.1',
    })
    await expect(response.json()).resolves.toEqual({
      data: { estimate_version_id: 'version-1', status: 'accepted' },
    })
  })

  it('accept route maps malformed input and invalid transitions clearly', async () => {
    mockAcceptPublicEstimate.mockResolvedValueOnce({
      ok: false,
      kind: 'invalid_input',
      message: 'Legal name is required',
    })

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
      error: 'Legal name is required',
    })

    mockAcceptPublicEstimate.mockResolvedValue({
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

  it('decline route records the decline state and event metadata', async () => {
    mockDeclinePublicEstimate.mockResolvedValue({
      ok: true,
      data: { estimate_version_id: 'version-1', status: 'declined' },
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

    expect(mockDeclinePublicEstimate).toHaveBeenCalledWith({
      token: 'token-1',
      reason: 'Going another direction',
    })
    await expect(response.json()).resolves.toEqual({
      data: { estimate_version_id: 'version-1', status: 'declined' },
    })
  })

  it('decline route maps idempotent retries and conflicts from the workflow service', async () => {
    mockDeclinePublicEstimate.mockResolvedValueOnce({
      ok: true,
      data: { estimate_version_id: 'version-1', status: 'declined' },
    })

    const retryResponse = await declineQuote(
      new Request('http://localhost/api/quote-public/token-1/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Still declining' }),
      }),
      {
        params: { token: 'token-1' },
      }
    )

    expect(retryResponse.status).toBe(200)
    await expect(retryResponse.json()).resolves.toEqual({
      data: { estimate_version_id: 'version-1', status: 'declined' },
    })

    mockDeclinePublicEstimate.mockResolvedValueOnce({
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
