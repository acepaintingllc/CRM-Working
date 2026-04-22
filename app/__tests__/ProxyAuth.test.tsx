import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockGetUser, mockCreateServerClient } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCreateServerClient: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}))

import { proxy, resetPublicTokenRateLimitState } from '../../proxy'

describe('proxy auth routing hardening', () => {
  beforeEach(() => {
    resetPublicTokenRateLimitState()
    mockGetUser.mockReset()
    mockCreateServerClient.mockReset()
    mockCreateServerClient.mockReturnValue({
      auth: {
        getUser: mockGetUser,
      },
    })
  })

  afterEach(() => {
    resetPublicTokenRateLimitState()
  })

  it('redirects unauthenticated crm requests to login before render', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })

    const response = await proxy(new NextRequest('http://localhost/crm/customers'))

    expect(mockCreateServerClient).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/login')
  })

  it('passes through public estimate pages and estimate-public api routes without auth gating', async () => {
    const estimatePageResponse = await proxy(
      new NextRequest('http://localhost/estimate/public-token')
    )
    const estimateApiResponse = await proxy(
      new NextRequest('http://localhost/api/estimate-public/public-token')
    )

    expect(mockCreateServerClient).not.toHaveBeenCalled()
    expect(estimatePageResponse.status).toBe(200)
    expect(estimatePageResponse.headers.get('location')).toBeNull()
    expect(estimateApiResponse.status).toBe(200)
    expect(estimateApiResponse.headers.get('location')).toBeNull()
  })

  it('rate limits repeated public token enumeration requests', async () => {
    for (let index = 0; index < 60; index += 1) {
      const response = await proxy(
        new NextRequest('http://localhost/api/quote-public/token-1', {
          headers: {
            'x-forwarded-for': '203.0.113.10',
          },
        })
      )

      expect(response.status).toBe(200)
    }

    const limitedResponse = await proxy(
      new NextRequest('http://localhost/api/quote-public/token-1', {
        headers: {
          'x-forwarded-for': '203.0.113.10',
        },
      })
    )

    expect(limitedResponse.status).toBe(429)
  })
})
