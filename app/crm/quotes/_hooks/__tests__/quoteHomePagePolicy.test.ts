import { describe, expect, it } from 'vitest'
import type { QuoteHomeJobListItemReadModel } from '@/lib/quotes/collectionData'
import {
  normalizeQuoteHomeJobQuery,
  resolveQuoteHomeBootstrapJobsSync,
  resolveQuoteHomeJobsRefresh,
  resolveQuoteHomeManualSelection,
  resolveQuoteHomeQueryJobsSync,
  resolveQuoteHomeSelectedJob,
  resolveQuoteHomeSelectedJobId,
  resolveQuoteHomeSelection,
  resolveQuoteHomeSelectionAfterJobsLoaded,
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

  it('falls back to the first job id when the initial selected job id is empty', () => {
    expect(resolveQuoteHomeSelectedJobId([kitchenJob, exteriorJob], '')).toBe(
      'job-1'
    )
  })

  it('returns an empty string for an empty jobs array', () => {
    expect(resolveQuoteHomeSelectedJobId([], 'job-1')).toBe('')
  })

  it('returns an empty string when no current match and no fallback job exist', () => {
    expect(resolveQuoteHomeSelectedJobId([], 'missing-job')).toBe('')
  })

  it('resolves the selected job and id together', () => {
    expect(resolveQuoteHomeSelectedJob([kitchenJob, exteriorJob], 'job-2')).toEqual({
      selectedJobId: 'job-2',
      selectedJob: exteriorJob,
    })
  })

  it('centralizes initial, loaded-jobs, and manual selection events', () => {
    const hiddenSelection = {
      selectedJobId: 'job-1',
      selectedJob: kitchenJob,
    }

    expect(
      resolveQuoteHomeSelection({
        event: 'initialize',
        jobs: [kitchenJob, exteriorJob],
        selectedJobId: null,
      })
    ).toEqual({
      selectedJobId: 'job-1',
      selectedJob: kitchenJob,
    })

    expect(
      resolveQuoteHomeSelection({
        event: 'loaded_jobs_changed',
        jobs: [exteriorJob],
        currentSelection: hiddenSelection,
        jobQuery: 'exterior',
      })
    ).toEqual(hiddenSelection)

    expect(
      resolveQuoteHomeSelection({
        event: 'manual_select',
        jobs: [kitchenJob, exteriorJob],
        selectedJobId: 'job-2',
      })
    ).toEqual({
      selectedJobId: 'job-2',
      selectedJob: exteriorJob,
    })
  })

  it('preserves a selected job snapshot when a non-empty filter hides it', () => {
    expect(
      resolveQuoteHomeSelectionAfterJobsLoaded({
        jobs: [exteriorJob],
        currentSelection: {
          selectedJobId: 'job-1',
          selectedJob: kitchenJob,
        },
        jobQuery: 'exterior',
      })
    ).toEqual({
      selectedJobId: 'job-1',
      selectedJob: kitchenJob,
    })
  })

  it('updates the selected job snapshot when the selected job is in loaded results', () => {
    const updatedKitchenJob = {
      ...kitchenJob,
      title: 'Kitchen Updated',
      version_count: 3,
    }

    expect(
      resolveQuoteHomeSelectionAfterJobsLoaded({
        jobs: [updatedKitchenJob, exteriorJob],
        currentSelection: {
          selectedJobId: 'job-1',
          selectedJob: kitchenJob,
        },
        jobQuery: 'kitchen',
      })
    ).toEqual({
      selectedJobId: 'job-1',
      selectedJob: updatedKitchenJob,
    })
  })

  it('falls back when an unfiltered loaded result no longer includes the selected job', () => {
    expect(
      resolveQuoteHomeSelectionAfterJobsLoaded({
        jobs: [exteriorJob],
        currentSelection: {
          selectedJobId: 'job-1',
          selectedJob: kitchenJob,
        },
        jobQuery: '',
      })
    ).toEqual({
      selectedJobId: 'job-2',
      selectedJob: exteriorJob,
    })
  })

  it('keeps manual selection tied to a visible loaded job', () => {
    expect(
      resolveQuoteHomeManualSelection({
        jobs: [kitchenJob, exteriorJob],
        selectedJobId: 'job-2',
      })
    ).toEqual({
      selectedJobId: 'job-2',
      selectedJob: exteriorJob,
    })

    expect(
      resolveQuoteHomeManualSelection({
        jobs: [kitchenJob],
        selectedJobId: 'job-2',
      })
    ).toEqual({
      selectedJobId: '',
      selectedJob: null,
    })
  })

  it('adopts refreshed bootstrap jobs only when they match the active query', () => {
    const bootstrapJobsPage = {
      query: '',
      limit: 25,
      next_cursor: null,
      items: [kitchenJob],
    }

    expect(
      resolveQuoteHomeBootstrapJobsSync({
        activeJobQuery: '',
        bootstrapJobsPage,
      })
    ).toEqual({
      action: 'adopt_bootstrap_jobs',
      jobsPage: bootstrapJobsPage,
    })

    expect(
      resolveQuoteHomeBootstrapJobsSync({
        activeJobQuery: 'garage',
        bootstrapJobsPage,
      })
    ).toEqual({
      action: 'keep_active_jobs',
      reason: 'bootstrap_query_mismatch',
    })
  })

  it('loads jobs when the active query differs from the current page', () => {
    const currentJobsPage = {
      query: '',
      limit: 25,
      next_cursor: null,
      items: [kitchenJob],
    }

    expect(
      resolveQuoteHomeQueryJobsSync({
        activeJobQuery: '',
        currentJobsPage,
      })
    ).toEqual({
      action: 'keep_current_jobs',
      reason: 'query_already_loaded',
    })

    expect(
      resolveQuoteHomeQueryJobsSync({
        activeJobQuery: ' garage ',
        currentJobsPage,
      })
    ).toEqual({
      action: 'load_query_jobs',
      query: 'garage',
    })
  })

  it('makes bootstrap refresh behavior explicit for filtered and unfiltered jobs', () => {
    const refreshedBootstrapJobsPage = {
      query: '',
      limit: 25,
      next_cursor: null,
      items: [kitchenJob],
    }

    expect(
      resolveQuoteHomeJobsRefresh({
        activeJobQuery: '',
        refreshedBootstrapJobsPage,
      })
    ).toEqual({
      action: 'adopt_bootstrap_jobs',
      jobsPage: refreshedBootstrapJobsPage,
    })

    expect(
      resolveQuoteHomeJobsRefresh({
        activeJobQuery: 'garage',
        refreshedBootstrapJobsPage,
      })
    ).toEqual({
      action: 'load_active_query_jobs',
      query: 'garage',
    })
  })
})
