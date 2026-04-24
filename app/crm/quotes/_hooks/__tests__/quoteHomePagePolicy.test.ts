import { describe, expect, it } from 'vitest'
import type { QuoteHomeJobListItemReadModel } from '@/lib/quotes/collectionData'
import {
  filterQuoteHomeJobs,
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
  it('returns the original jobs list when the query is empty', () => {
    const jobs = [kitchenJob, exteriorJob]

    expect(filterQuoteHomeJobs(jobs, '   ')).toBe(jobs)
  })

  it('filters jobs by matching title, customer, or address text', () => {
    expect(filterQuoteHomeJobs([kitchenJob, exteriorJob], ' alice ')).toEqual([
      kitchenJob,
    ])
    expect(filterQuoteHomeJobs([kitchenJob, exteriorJob], 'oak')).toEqual([
      exteriorJob,
    ])
  })

  it('returns an empty list when no jobs match the query', () => {
    expect(filterQuoteHomeJobs([kitchenJob, exteriorJob], 'basement')).toEqual([])
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
