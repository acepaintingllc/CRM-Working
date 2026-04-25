import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  quoteHomeBootstrap,
  quoteHomeJob1Versions,
  quoteHomeJobs,
} from '@/test-support/quoteHomeFixtures'
import { useQuoteHomePageResource } from '../quoteHomePageResource'

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}))

const {
  createQuoteVersion,
  deleteQuoteVersion,
  loadQuoteHomeBootstrap,
  loadQuoteHomeJobs,
  loadQuoteHomeSearch,
  loadQuoteJobVersions,
} = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  deleteQuoteVersion: vi.fn(),
  loadQuoteHomeBootstrap: vi.fn(),
  loadQuoteHomeJobs: vi.fn(),
  loadQuoteHomeSearch: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  deleteQuoteVersion,
  loadQuoteHomeBootstrap,
  loadQuoteHomeJobs,
  loadQuoteHomeSearch,
  loadQuoteJobVersions,
}))

describe('useQuoteHomePageResource', () => {
  it('exposes named sub-resources and one stable VM input for the page facade', async () => {
    loadQuoteHomeSearch.mockResolvedValue({ query: '', items: [] })
    loadQuoteJobVersions.mockResolvedValue(quoteHomeJob1Versions)

    const { result } = renderHook(() => useQuoteHomePageResource(quoteHomeBootstrap))

    await waitFor(() => {
      expect(result.current.resources.page.selectedJobId).toBe('job-1')
    })

    expect(result.current.resources.home.jobs).toEqual(quoteHomeJobs)
    expect(result.current.resources.search.results).toEqual([])
    expect(result.current.resources.workflow.versions.items).toEqual(
      quoteHomeJob1Versions.items
    )
    expect(result.current.resources.delete).toBe(
      result.current.resources.controller.deleteState
    )
    expect(result.current.vmInput.state.actions).toBe(
      result.current.resources.controller.actions
    )
    expect(result.current.vmInput.resources.workflow.versions.items).toEqual(
      quoteHomeJob1Versions.items
    )
  })
})
