import { describe, expect, it } from 'vitest'
import type {
  QuoteHomeJobListItemReadModel,
  QuoteHomeJobVersionItemReadModel,
} from '@/lib/quotes/collectionData'
import {
  buildHeroSummaryText,
  buildSearchResultVm,
  buildQuoteHomeVersionItemVm,
  buildQuotesHomeSelectedJobVm,
} from '../quoteHomePresentation'

const estimate: QuoteHomeJobVersionItemReadModel = {
  estimate_id: 'estimate-1',
  job_id: 'job-1',
  customer_id: 'customer-1',
  version_name: 'Kitchen Revision',
  version_state: 'live',
  version_kind: 'revision',
  version_sort_order: 2,
  job_title: 'Kitchen',
  customer_name: 'Alice',
  final_total: 1250,
  updated_at: '2026-04-21T10:00:00.000Z',
  created_at: '2026-04-20T10:00:00.000Z',
  is_sent_estimate: true,
}

const job: QuoteHomeJobListItemReadModel = {
  id: 'job-1',
  customer_id: 'customer-1',
  customer_name: 'Alice',
  customer_address: '123 Main',
  title: 'Kitchen',
  description: null,
  status: 'estimate_sent',
  created_at: null,
  estimate_date: null,
  estimate_sent_at: null,
  scheduled_date: null,
  scheduled_end_date: null,
  scheduled_email_sent_at: null,
  completed_at: null,
  completed_email_sent_at: null,
  closeout_notes: null,
  linked_estimate_id: null,
  version_count: 4,
}

describe('quoteHomePresentation', () => {
  it('builds hero summary text from summary counts', () => {
    expect(
      buildHeroSummaryText({
        total_versions: 24,
        draft_count: 2,
        sent_or_awaiting_count: 3,
        live_count: 1,
        pipeline_total: 5000,
      })
    ).toBe('24 total versions · 2 drafts · 3 sent/awaiting · 1 live')
  })

  it('builds selected-job and version item view models', () => {
    const selectedVm = buildQuotesHomeSelectedJobVm(job, 4, false)
    expect(selectedVm.title).toBe('Kitchen')
    expect(selectedVm.customerLine).toBe('Alice · 123 Main')
    expect(selectedVm.stats).toEqual([
      { label: 'Customer', value: 'Alice' },
      { label: 'Job Status', value: 'Estimate Sent' },
      { label: 'Versions', value: '4' },
    ])

    const versionVm = buildQuoteHomeVersionItemVm(estimate, 'estimate-1')
    expect(versionVm.total).toBe('$1,250')
    expect(versionVm.href).toBe('/crm/quotes/estimate-1')
    expect(versionVm.deleting).toBe(true)
    expect(versionVm.meta).toContain('Live / Revision · Updated')
  })

  it('builds search result view models from shared home version items', () => {
    expect(buildSearchResultVm(estimate)).toEqual({
      id: 'estimate-1',
      href: '/crm/quotes/estimate-1',
      title: 'Kitchen Revision',
      meta: 'Kitchen\nAlice / Live',
    })
  })
})
