import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLoadPublicEstimateSnapshot } = vi.hoisted(() => ({
  mockLoadPublicEstimateSnapshot: vi.fn(),
}))

vi.mock('@/lib/server/estimatePublicPortal', () => ({
  loadPublicEstimatePortalSnapshot: mockLoadPublicEstimateSnapshot,
}))

vi.mock('../QuotePortalClient', () => ({
  default: ({ snapshot }: { snapshot: { estimate_version_id: string } }) => (
    <div>Loaded quote {snapshot.estimate_version_id}</div>
  ),
}))

import PublicQuotePage from '../page'

describe('PublicQuotePage', () => {
  beforeEach(() => {
    mockLoadPublicEstimateSnapshot.mockReset()
  })

  it('loads the public page through the shared portal snapshot contract', async () => {
    mockLoadPublicEstimateSnapshot.mockResolvedValue({
      ok: true,
      data: {
        estimate_version_id: 'version-1',
      },
    })

    render(
      await PublicQuotePage({
        params: Promise.resolve({ token: 'token-1' }),
        searchParams: Promise.resolve({ print: '1' }),
      })
    )

    expect(mockLoadPublicEstimateSnapshot).toHaveBeenCalledWith({
      token: 'token-1',
      actorType: 'customer',
      metadata: {
        route: 'public-page',
      },
    })
    expect(screen.getByText('Loaded quote version-1')).toBeInTheDocument()
  })

  it('shows specific invalid-token copy', async () => {
    mockLoadPublicEstimateSnapshot.mockResolvedValue({
      ok: false,
      kind: 'invalid_input',
      message: 'Invalid token',
    })

    render(
      await PublicQuotePage({
        params: Promise.resolve({ token: '' }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(screen.getByText("This quote link isn't valid")).toBeInTheDocument()
    expect(
      screen.getByText(
        'This quote link is incomplete or no longer valid. Please contact us for a new link.'
      )
    ).toBeInTheDocument()
  })

  it('shows specific not-found copy', async () => {
    mockLoadPublicEstimateSnapshot.mockResolvedValue({
      ok: false,
      kind: 'not_found',
      message: 'Quote not found',
    })

    render(
      await PublicQuotePage({
        params: Promise.resolve({ token: 'missing' }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(screen.getByText('This quote is no longer available')).toBeInTheDocument()
    expect(
      screen.getByText(
        'This quote is no longer available. Please contact us if you need an updated copy or a new link.'
      )
    ).toBeInTheDocument()
  })

  it('falls back to generic unavailable copy for other failures', async () => {
    mockLoadPublicEstimateSnapshot.mockResolvedValue({
      ok: false,
      kind: 'server_error',
      message: 'Database unavailable',
    })

    render(
      await PublicQuotePage({
        params: Promise.resolve({ token: 'token-1' }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(screen.getByText('Quote unavailable')).toBeInTheDocument()
    expect(screen.getByText("This quote isn't available right now. Please try again or contact us.")).toBeInTheDocument()
  })
})
