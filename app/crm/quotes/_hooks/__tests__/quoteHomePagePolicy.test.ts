import { describe, expect, it } from 'vitest'
import type { QuoteHomeJobListItemReadModel } from '@/lib/quotes/collectionData'
import {
  normalizeQuoteHomeJobQuery,
  resolveQuoteHomeSelectedJobId,
} from '../quoteHomePagePolicy'

const kitchenJob: QuoteHomeJobListItemReadModel = {
  id: 'job-1',
  customer_id: 'customer-1',
  customer_name: 'Alice Painter',
  customer_address: '123 Main Street',
  title: 'Kitchen Refresh',
  description: null,
  status: 'estimate_pending',
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
  version_count: 2,
}

const exteriorJob: QuoteHomeJobListItemReadModel = {
  ...kitchenJob,
  id: 'job-2',
  customer_id: 'customer-2',
  customer_name: 'Bob Builder',
  customer_address: '456 Oak Avenue',
  title: 'Exterior Trim',
  status: 'estimate_sent',
  version_count: 1,
}

describe('quoteHomePagePolicy', () => {
  it('normalizes the server-backed job query before requests are made', () => {
    expect(normalizeQuoteHomeJobQuery('  garage  ')).toBe('garage')
    expect(normalizeQuoteHomeJobQuery('   ')).toBe('')
  })

  it('keeps the current selected job id when it still exists', () => {
    expect(resolveQuoteHomeSelectedJobId([kitchenJob, exteriorJob], 'job-2')).toBe(
      'job-2'
    )
  })

  it('falls back to the first job id when the current selection is missing', () => {
    expect(
      resolveQuoteHomeSelectedJobId([kitchenJob, exteriorJob], 'missing-job')
    ).toBe('job-1')
  })

  it('returns an empty string when no jobs are available', () => {
    expect(resolveQuoteHomeSelectedJobId([], 'job-1')).toBe('')
  })
})
