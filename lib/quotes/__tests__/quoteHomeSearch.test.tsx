import { describe, expect, it } from 'vitest'
import { QUOTE_HOME_SEARCH_SOURCE_RANK } from '../quoteHomeTypes'
import { selectQuoteHomeSearchRows, toQuoteHomeSearchCandidates } from '../quoteHomeSearch'
import type { EstimateCollectionVersionRow } from '@/lib/server/estimate-collection/types'

function makeRow(
  id: string,
  updatedAt: string,
  overrides: Partial<EstimateCollectionVersionRow> = {},
): EstimateCollectionVersionRow {
  return {
    id,
    job_id: 'job-1',
    customer_id: 'customer-1',
    status: 'draft',
    version_name: 'Version',
    version_state: 'draft',
    version_kind: 'standard',
    version_sort_order: 1,
    created_at: '2026-04-20T10:00:00.000Z',
    updated_at: updatedAt,
    ...overrides,
  }
}

describe('quote home search policy', () => {
  it('labels candidates with the explicit source ranking policy', () => {
    const version = makeRow('estimate-version', '2026-04-20T10:00:00.000Z')
    const job = makeRow('estimate-job', '2026-04-24T10:00:00.000Z')
    const customer = makeRow('estimate-customer', '2026-04-23T10:00:00.000Z')

    expect(QUOTE_HOME_SEARCH_SOURCE_RANK).toEqual({ version: 0, job: 1, customer: 2 })
    expect(
      toQuoteHomeSearchCandidates({
        query: 'kit',
        candidateLimit: 3,
        versionRows: [version],
        jobRows: [job],
        customerRows: [customer],
      }).map((candidate) => ({
        id: candidate.row.id,
        source: candidate.source,
        rank: candidate.rank,
      })),
    ).toEqual([
      { id: 'estimate-version', source: 'version', rank: 0 },
      { id: 'estimate-job', source: 'job', rank: 1 },
      { id: 'estimate-customer', source: 'customer', rank: 2 },
    ])
  })

  it('sorts by source rank before recency and dedupes before capping', () => {
    const directOld = makeRow('estimate-direct-old', '2026-04-20T10:00:00.000Z')
    const jobNew = makeRow('estimate-job-new', '2026-04-24T10:00:00.000Z')
    const duplicate = makeRow('estimate-duplicate', '2026-04-22T10:00:00.000Z')

    expect(
      selectQuoteHomeSearchRows({
        query: 'kitchen',
        candidateLimit: 3,
        limit: 3,
        versionRows: [directOld, duplicate],
        jobRows: [jobNew, duplicate],
        customerRows: [duplicate],
      }).map((row) => row.id),
    ).toEqual(['estimate-duplicate', 'estimate-direct-old', 'estimate-job-new'])
  })
})
