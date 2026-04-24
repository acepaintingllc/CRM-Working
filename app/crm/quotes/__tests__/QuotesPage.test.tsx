import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import QuotesPage from '../page'

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

  it('redirects to login when the session lookup fails', async () => {
    getSessionUserOrg.mockResolvedValue({ error: 'Not authenticated' })

    await expect(QuotesPage()).rejects.toThrow('NEXT_REDIRECT')

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

    render(await QuotesPage())

    expect(loadQuoteHomeBootstrap).toHaveBeenCalledWith('org-1')
    expect(screen.getByTestId('quotes-home-page')).toHaveTextContent(JSON.stringify(bootstrapData))
  })
})
