import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import QuotesPage from '../page'
import { QuoteHomeServerBootstrap } from '../QuoteHomeServerBootstrap'

const { redirect, getSessionUserOrg, loadQuoteHomeBootstrap } = vi.hoisted(() => ({
  redirect: vi.fn(),
  getSessionUserOrg: vi.fn(),
  loadQuoteHomeBootstrap: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect,
}))

vi.mock('@/lib/server/org', () => ({
  getSessionUserOrg,
}))

vi.mock('@/lib/server/estimateCollectionData', () => ({
  loadQuoteHomeBootstrap,
}))

vi.mock('../QuotesHomePage', () => ({
  default: ({ initialData }: { initialData: unknown }) => (
    <div data-testid="quotes-home-page">{JSON.stringify(initialData)}</div>
  ),
}))

describe('QuotesPage', () => {
  beforeEach(() => {
    redirect.mockReset()
    getSessionUserOrg.mockReset()
    loadQuoteHomeBootstrap.mockReset()
    redirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT')
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the route entrypoint delegated to the named server bootstrap wrapper', () => {
    expect(QuotesPage()).toMatchObject({
      type: QuoteHomeServerBootstrap,
      props: {},
    })
  })

  it('redirects to login when the session lookup fails', async () => {
    getSessionUserOrg.mockResolvedValue({ error: 'Not authenticated' })

    await expect(QuoteHomeServerBootstrap()).rejects.toThrow('NEXT_REDIRECT')

    expect(redirect).toHaveBeenCalledWith('/login?next=%2Fcrm%2Fquotes')
    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
  })

  it('preserves the valid-session bootstrap flow', async () => {
    const bootstrapData = {
      summary: { totalVersions: 3 },
      jobs: [],
    }

    getSessionUserOrg.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    loadQuoteHomeBootstrap.mockResolvedValue({
      ok: true,
      data: bootstrapData,
    })

    render(await QuoteHomeServerBootstrap())

    expect(loadQuoteHomeBootstrap).toHaveBeenCalledWith('org-1')
    expect(screen.getByTestId('quotes-home-page')).toHaveTextContent(JSON.stringify(bootstrapData))
  })

  it('falls back to client-side loading when the server bootstrap read model fails', async () => {
    getSessionUserOrg.mockResolvedValue({ userId: 'user-1', orgId: 'org-1' })
    loadQuoteHomeBootstrap.mockResolvedValue({
      ok: false,
      error: 'database_unavailable',
      message: 'Could not load quote home bootstrap.',
    })

    render(await QuoteHomeServerBootstrap())

    expect(loadQuoteHomeBootstrap).toHaveBeenCalledWith('org-1')
    expect(screen.getByTestId('quotes-home-page')).toHaveTextContent('null')
  })
})
