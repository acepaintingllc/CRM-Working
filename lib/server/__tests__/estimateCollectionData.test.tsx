import { describe, expect, it, vi } from 'vitest'

const { loadEstimateCollectionBootstrapPayload } = vi.hoisted(() => ({
  loadEstimateCollectionBootstrapPayload: vi.fn(),
}))

vi.mock('@/lib/server/estimate-collection/service', () => ({
  loadEstimateCollectionBootstrapPayload,
}))

import { loadQuoteHomeBootstrap } from '../estimateCollectionData'

describe('estimateCollectionData', () => {
  it('re-exports the quote-home bootstrap loader from the shared service boundary', async () => {
    loadEstimateCollectionBootstrapPayload.mockResolvedValue({
      ok: true,
      data: {
        summary: { total_versions: 3 },
        jobs: { query: '', limit: 25, next_cursor: null, items: [] },
        selected_job_id: null,
        selected_job_versions: null,
      },
    })

    await expect(loadQuoteHomeBootstrap('org-1')).resolves.toEqual({
      ok: true,
      data: {
        summary: { total_versions: 3 },
        jobs: { query: '', limit: 25, next_cursor: null, items: [] },
        selected_job_id: null,
        selected_job_versions: null,
      },
    })
    expect(loadEstimateCollectionBootstrapPayload).toHaveBeenCalledWith('org-1')
  })
})
