import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  QuoteHomeJobListItemReadModel,
  QuoteHomeJobVersionItemReadModel,
  QuoteHomeSearchResultReadModel,
} from '@/lib/quotes/collectionData'
import {
  buildHomeLoadFailureDetail,
  buildHeroSummaryText,
  buildQuoteHomeVersionItemVm,
  buildQuotesHomeFeedbackVm,
  buildQuotesHomeDeleteDialogVm,
  buildQuotesHomeHeaderSearchStatus,
  buildQuotesHomeJobListEmptyState,
  buildQuotesHomeJobListStatus,
  buildQuotesHomeJobListStatusFromVm,
  buildQuotesHomeSearchCanRetry,
  buildQuotesHomeSearchEmptyMessage,
  buildQuotesHomeSearchStatus,
  buildQuotesHomeSelectedJobVersionCount,
  buildQuotesHomeSelectedJobVm,
  buildQuotesHomeVersionDetail,
  buildQuotesHomeVersionHeading,
  buildQuotesHomeVersionListStatus,
  buildSearchResultVm,
  buildSummaryCards,
  formatVersionCount,
  formatToday,
  QUOTE_META_SEPARATOR,
  QUOTES_HOME_RECOVERY_COPY,
  SETTINGS_LINKS,
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

const searchResult: QuoteHomeSearchResultReadModel = {
  estimate_id: 'estimate-search-1',
  job_id: 'job-1',
  customer_id: 'customer-1',
  version_name: 'Kitchen Search Result',
  version_state: 'draft',
  version_kind: 'standard',
  job_title: 'Kitchen',
  customer_name: 'Alice',
  updated_at: '2026-04-21T10:00:00.000Z',
  final_total: 1250,
  is_sent_estimate: false,
}

describe('quoteHomePresentation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('locks the quote meta separator to a middle dot', () => {
    expect(QUOTE_META_SEPARATOR).toBe(' \u00B7 ')
  })

  it('exports the settings links used by the header', () => {
    expect(SETTINGS_LINKS).toEqual([
      { label: 'Defaults', href: '/crm/quotes/defaults' },
      { label: 'Products', href: '/crm/quotes/products' },
      { label: 'Rates & Flags', href: '/crm/quotes/rates' },
      { label: 'Settings', href: '/crm/settings' },
    ])
  })

  it('exports shared recovery copy for the quote-home boundary', () => {
    expect(QUOTES_HOME_RECOVERY_COPY).toEqual({
      title: 'Something went wrong loading quotes',
      reloadLabel: 'Reload',
    })
  })

  it('formats today for the header eyebrow', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 24))

    expect(formatToday()).toBe('FRIDAY / APRIL 24, 2026')
  })

  it('builds hero summary text from summary counts', () => {
    expect(
      buildHeroSummaryText({
        total_versions: 24,
        draft_count: 2,
        sent_or_awaiting_count: 3,
        live_count: 1,
        pipeline_total: 5000,
      })
    ).toBe('24 total versions \u00B7 2 drafts \u00B7 3 sent/awaiting \u00B7 1 live')
  })

  it('builds selected-job and version item view models', () => {
    const selectedVm = buildQuotesHomeSelectedJobVm(job, 4, false)
    expect(selectedVm.title).toBe('Kitchen')
    expect(selectedVm.customerLine).toBe('Alice \u00B7 123 Main')
    expect(selectedVm.stats).toEqual([
      { label: 'Customer', value: 'Alice' },
      { label: 'Job Status', value: 'Estimate Sent' },
      { label: 'Versions', value: '4' },
    ])

    const versionVm = buildQuoteHomeVersionItemVm(estimate, 'estimate-1')
    expect(versionVm.total).toBe('$1,250')
    expect(versionVm.href).toBe('/crm/quotes/estimate-1')
    expect(versionVm.deleting).toBe(true)
    expect(versionVm.deleteDisabled).toBe(true)
    expect(versionVm.deleteBusy).toBe(true)
    expect(versionVm.deleteButtonLabel).toBe('Deleting...')
    expect(versionVm.deleteButtonAriaLabel).toBe(
      'Deleting quote version Kitchen Revision',
    )
    expect(versionVm.meta).toContain('Live / Revision \u00B7 Updated')
  })

  it('disables non-active delete buttons while another version is deleting', () => {
    const versionVm = buildQuoteHomeVersionItemVm(estimate, 'estimate-2')

    expect(versionVm.deleting).toBe(false)
    expect(versionVm.deleteDisabled).toBe(true)
    expect(versionVm.deleteBusy).toBe(false)
    expect(versionVm.deleteButtonLabel).toBe('Delete')
    expect(versionVm.deleteButtonAriaLabel).toBe(
      'Delete quote version Kitchen Revision unavailable while another version is deleting',
    )
  })

  it('builds destructive dialog copy and disabled state from delete resources', () => {
    expect(buildQuotesHomeDeleteDialogVm(estimate, 'estimate-1')).toEqual({
      isOpen: true,
      estimateId: 'estimate-1',
      versionName: 'Kitchen Revision',
      jobTitle: 'Kitchen',
      deleting: true,
      title: 'Delete Kitchen Revision?',
      description:
        'Permanently delete quote version Kitchen Revision from Kitchen.',
      closeLabel: 'Close delete confirmation',
      warning: 'This permanently deletes the quote version. This cannot be undone.',
      info:
        'The home page will refresh job counts and the selected job version list after delete.',
      cancelLabel: 'Cancel',
      cancelAriaLabel: 'Cancel deleting quote version Kitchen Revision',
      confirmLabel: 'Delete Kitchen Revision',
      confirmAriaLabel:
        'Permanently delete quote version Kitchen Revision from Kitchen',
      confirmingLabel: 'Deleting Kitchen Revision...',
      confirmingAriaLabel: 'Deleting quote version Kitchen Revision from Kitchen',
      confirmDisabled: true,
      cancelDisabled: true,
    })
  })

  it('builds version-history heading from the full count, not the loaded page length', () => {
    expect(buildQuotesHomeVersionHeading(job, 30)).toBe(
      '30 versions under this job'
    )
  })

  it('formats version counts consistently across quote home labels', () => {
    expect(formatVersionCount(0)).toBe('0 versions')
    expect(formatVersionCount(1)).toBe('1 version')
    expect(formatVersionCount(2)).toBe('2 versions')
  })

  it('derives selected-job version count from resolved resources or job fallback', () => {
    expect(
      buildQuotesHomeSelectedJobVersionCount({
        selectedJob: job,
        totalVersions: 30,
        hasResolved: true,
      })
    ).toBe(30)

    expect(
      buildQuotesHomeSelectedJobVersionCount({
        selectedJob: job,
        totalVersions: 0,
        hasResolved: false,
      })
    ).toBe(4)

    expect(
      buildQuotesHomeSelectedJobVersionCount({
        selectedJob: null,
        totalVersions: 7,
        hasResolved: false,
      })
    ).toBe(7)
  })

  it('returns null version detail when no job is selected', () => {
    expect(
      buildQuotesHomeVersionDetail(null, {
        loadedVersions: 25,
        totalVersions: 30,
        hasMore: true,
      })
    ).toBeNull()
  })

  it('returns null version detail when the selected job has no versions', () => {
    expect(
      buildQuotesHomeVersionDetail(job, {
        loadedVersions: 0,
        totalVersions: 0,
        hasMore: false,
      })
    ).toBeNull()
  })

  it('returns null version detail when no versions are loaded yet', () => {
    expect(
      buildQuotesHomeVersionDetail(job, {
        loadedVersions: 0,
        totalVersions: 30,
        hasMore: false,
      })
    ).toBeNull()
  })

  it('builds paginated version detail when more versions can be loaded', () => {
    expect(
      buildQuotesHomeVersionDetail(job, {
        loadedVersions: 25,
        totalVersions: 30,
        hasMore: true,
      })
    ).toBe('Showing 25 of 30 versions.')
  })

  it('builds all-loaded version detail when loaded and total counts match', () => {
    expect(
      buildQuotesHomeVersionDetail(job, {
        loadedVersions: 30,
        totalVersions: 30,
        hasMore: false,
      })
    ).toBe('Showing all 30 versions.')
  })

  it('builds reload version detail when no more pages exist but counts differ', () => {
    expect(
      buildQuotesHomeVersionDetail(job, {
        loadedVersions: 25,
        totalVersions: 30,
        hasMore: false,
      })
    ).toBe('Showing 25 of 30 versions - reload to see all.')
  })

  it('builds search result view models from search result read models', () => {
    expect(buildSearchResultVm(searchResult)).toEqual({
      id: 'estimate-search-1',
      href: '/crm/quotes/estimate-search-1',
      title: 'Kitchen Search Result',
      meta: 'Kitchen\nAlice / Draft',
    })
  })

  it('builds search empty messaging only for completed empty searches', () => {
    expect(
      buildQuotesHomeSearchEmptyMessage({
        query: 'missing',
        loading: false,
        error: null,
        resultCount: 0,
      })
    ).toBe('No quote versions match "missing".')

    expect(
      buildQuotesHomeSearchEmptyMessage({
        query: '',
        loading: false,
        error: null,
        resultCount: 0,
      })
    ).toBeNull()

    expect(
      buildQuotesHomeSearchEmptyMessage({
        query: 'missing',
        loading: true,
        error: null,
        resultCount: 0,
      })
    ).toBeNull()

    expect(
      buildQuotesHomeSearchEmptyMessage({
        query: 'missing',
        loading: false,
        error: 'search failed',
        resultCount: 0,
      })
    ).toBeNull()

    expect(
      buildQuotesHomeSearchEmptyMessage({
        query: 'missing',
        loading: false,
        error: null,
        resultCount: 1,
      })
    ).toBeNull()
  })

  it('builds search retry eligibility from resource state', () => {
    expect(buildQuotesHomeSearchCanRetry({ query: 'missing', loading: false })).toBe(
      true
    )
    expect(buildQuotesHomeSearchCanRetry({ query: '', loading: false })).toBe(false)
    expect(buildQuotesHomeSearchCanRetry({ query: 'missing', loading: true })).toBe(
      false
    )
  })

  it('builds display-ready search status states', () => {
    expect(
      buildQuotesHomeSearchStatus({
        query: '',
        loading: false,
        error: null,
        resultCount: 0,
      })
    ).toEqual({ kind: 'idle' })

    expect(
      buildQuotesHomeSearchStatus({
        query: 'kitchen',
        loading: true,
        error: null,
        resultCount: 0,
      })
    ).toEqual({
      kind: 'loading',
      title: 'Searching quote versions',
      message: 'Looking up versions that match "kitchen".',
    })

    expect(
      buildQuotesHomeSearchStatus({
        query: 'kitchen',
        loading: false,
        error: 'search failed',
        resultCount: 0,
      })
    ).toEqual({
      kind: 'error',
      title: 'Search results failed to load',
      message: 'search failed',
      canRetry: true,
    })
  })

  it('keeps header legacy search status resolution in presentation helpers', () => {
    expect(
      buildQuotesHomeHeaderSearchStatus({
        query: 'missing',
        loading: false,
        errorMessage: null,
        emptyMessage: null,
        resultCount: 0,
        canRetry: true,
      })
    ).toEqual({ kind: 'idle' })

    expect(
      buildQuotesHomeHeaderSearchStatus({
        query: 'missing',
        loading: false,
        errorMessage: null,
        emptyMessage: 'No quote versions match "missing".',
        resultCount: 0,
        canRetry: true,
      })
    ).toEqual({
      kind: 'empty',
      title: 'No matching quote versions',
      message: 'No quote versions match "missing".',
    })
  })

  it('formats bootstrap load failure details without doubling the fallback prefix', () => {
    expect(
      buildHomeLoadFailureDetail('bootstrap', 'Quote home failed to load.')
    ).toBe('Quote home failed to load.')

    expect(
      buildHomeLoadFailureDetail(
        'bootstrap',
        'Quote home failed to load. Network request timed out.'
      )
    ).toBe('Quote home failed to load. Network request timed out.')

    expect(buildHomeLoadFailureDetail('bootstrap', 'Server unavailable.')).toBe(
      'Quote home failed to load. Server unavailable.'
    )

    expect(buildHomeLoadFailureDetail('bootstrap', '')).toBe(
      'Quote home failed to load.'
    )
  })

  it('formats jobs load failure details without doubling the fallback prefix', () => {
    expect(
      buildHomeLoadFailureDetail('jobs', 'Quote home jobs failed to load.')
    ).toBe('Quote home jobs failed to load.')

    expect(buildHomeLoadFailureDetail('jobs', 'Server unavailable.')).toBe(
      'Quote home jobs failed to load. Server unavailable.'
    )
  })

  it('builds feedback for each individual error source and the null case', () => {
    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [
          { source: 'bootstrap', message: 'Quote home failed to load.' },
        ],
        jobVersionsError: null,
        createError: null,
        deleteError: null,
        actionWarning: null,
      })
    ).toEqual({
      tone: 'warning',
      title: 'Quote home bootstrap failed to load',
      details: ['Quote home failed to load.'],
      sources: ['bootstrap'],
    })

    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [],
        jobVersionsError: 'Failed to load job quote versions.',
        createError: null,
        deleteError: null,
        actionWarning: null,
      })
    ).toEqual({
      tone: 'warning',
      title: 'Quote home loaded with errors',
      details: ['Job versions failed to load.'],
      sources: ['jobVersions'],
    })

    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [],
        jobVersionsError: null,
        createError: 'Create failed.',
        deleteError: null,
        actionWarning: null,
      })
    ).toEqual({
      tone: 'error',
      title: 'Quote action failed',
      details: ['Create failed.'],
      sources: ['create'],
    })

    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [],
        jobVersionsError: null,
        createError: null,
        deleteError: 'Delete failed.',
        actionWarning: null,
      })
    ).toEqual({
      tone: 'error',
      title: 'Quote action failed',
      details: ['Delete failed.'],
      sources: ['delete'],
    })

    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [],
        jobVersionsError: null,
        createError: null,
        deleteError: null,
        actionWarning: {
          source: 'delete',
          message: 'Quote deleted, but refresh failed.',
        },
      })
    ).toEqual({
      tone: 'warning',
      title: 'Quote action completed with refresh errors',
      details: ['Quote deleted, but refresh failed.'],
      sources: ['delete'],
    })

    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [],
        jobVersionsError: null,
        createError: null,
        deleteError: null,
        actionWarning: {
          source: 'create',
          message: 'Quote created, but refresh failed.',
        },
      })
    ).toEqual({
      tone: 'warning',
      title: 'Quote action completed with refresh errors',
      details: ['Quote created, but refresh failed.'],
      sources: ['create'],
    })

    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [],
        jobVersionsError: null,
        createError: null,
        deleteError: null,
        actionWarning: null,
      })
    ).toBeNull()
  })

  it('builds feedback for the jobs load error branch', () => {
    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [{ source: 'jobs', message: 'Jobs timed out.' }],
        jobVersionsError: null,
        createError: null,
        deleteError: null,
        actionWarning: null,
      })
    ).toEqual({
      tone: 'warning',
      title: 'Quote home jobs failed to load',
      details: ['Quote home jobs failed to load. Jobs timed out.'],
      sources: ['jobs'],
    })
  })

  it('builds feedback for multiple home load failures', () => {
    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [
          { source: 'bootstrap', message: 'Bootstrap timed out.' },
          { source: 'jobs', message: 'Jobs timed out.' },
        ],
        jobVersionsError: null,
        createError: null,
        deleteError: null,
        actionWarning: null,
      })
    ).toEqual({
      tone: 'warning',
      title: 'Some quote home data failed to load',
      details: [
        'Quote home failed to load. Bootstrap timed out.',
        'Quote home jobs failed to load. Jobs timed out.',
      ],
      sources: ['bootstrap', 'jobs'],
    })
  })

  it('builds combined feedback details in source order', () => {
    expect(
      buildQuotesHomeFeedbackVm({
        homeFailures: [{ source: 'bootstrap', message: 'Timeout.' }],
        jobVersionsError: 'Service unavailable.',
        createError: 'Create failed.',
        deleteError: 'Delete failed.',
        actionWarning: null,
      })
    ).toEqual({
      tone: 'error',
      title: 'Quote action failed',
      details: [
        'Quote home failed to load. Timeout.',
        'Job versions failed to load. Service unavailable.',
        'Create failed.',
        'Delete failed.',
      ],
      sources: ['bootstrap', 'jobVersions', 'create', 'delete'],
    })
  })

  it('derives every job-list empty-state branch', () => {
    expect(
      buildQuotesHomeJobListEmptyState({
        hasLoadError: true,
        totalJobCount: 0,
        visibleJobCount: 0,
      })
    ).toBe('none')

    expect(
      buildQuotesHomeJobListEmptyState({
        hasLoadError: false,
        totalJobCount: 0,
        visibleJobCount: 0,
      })
    ).toBe('no_jobs')

    expect(
      buildQuotesHomeJobListEmptyState({
        hasLoadError: false,
        totalJobCount: 2,
        visibleJobCount: 0,
      })
    ).toBe('no_matches')

    expect(
      buildQuotesHomeJobListEmptyState({
        hasLoadError: false,
        totalJobCount: 2,
        visibleJobCount: 1,
      })
    ).toBe('none')
  })

  it('builds display-ready list status states', () => {
    expect(
      buildQuotesHomeJobListStatus({
        loading: true,
        errorMessage: null,
        canRetry: false,
        emptyState: 'none',
        emptyStateBody: null,
      })
    ).toEqual({ kind: 'loading', message: 'Loading jobs...' })

    expect(
      buildQuotesHomeVersionListStatus({
        errorMessage: 'versions failed',
        canRetry: true,
        emptyMessage: 'No versions.',
      })
    ).toEqual({
      kind: 'error',
      title: 'Versions failed to load',
      message: 'versions failed',
      canRetry: true,
      retryLabel: 'Retry versions',
      retryingLabel: 'Retrying versions...',
    })
  })

  it('builds legacy-compatible job-list status from the list vm', () => {
    expect(
      buildQuotesHomeJobListStatusFromVm({
        loading: false,
        searchQuery: '',
        selectedJobId: '',
        hasMore: false,
        items: [],
        errorMessage: null,
        canRetry: false,
        emptyState: 'no_matches',
        emptyStateBody: null,
      })
    ).toEqual({
      kind: 'empty',
      emptyState: 'no_matches',
      title: 'No jobs match this search.',
      body: null,
    })
  })

  it('builds summary cards for zero, non-zero, and null summaries', () => {
    expect(
      buildSummaryCards({
        total_versions: 0,
        draft_count: 0,
        sent_or_awaiting_count: 0,
        live_count: 0,
        pipeline_total: 0,
      })
    ).toEqual([
      {
        label: 'Drafts',
        value: '0',
        displayValue: '0',
        subtext: '0 draft versions',
        valueColor: 'var(--v2-ink)',
        subtextColor: 'var(--v2-ink-3)',
      },
      {
        label: 'Sent / Awaiting',
        value: '0',
        displayValue: '0',
        subtext: '0 versions attached to sent jobs',
        valueColor: 'var(--v2-ink)',
        subtextColor: 'var(--v2-ink-3)',
      },
      {
        label: 'Live Versions',
        value: '0',
        displayValue: '0',
        subtext: '0 live versions',
        valueColor: 'var(--v2-green-2)',
        subtextColor: 'var(--v2-green-2)',
      },
      {
        label: 'Pipeline',
        value: '$0',
        displayValue: '$0',
        subtext: 'Rollup-backed total',
        valueColor: 'var(--v2-amber)',
        subtextColor: 'var(--v2-ink-3)',
      },
    ])

    expect(
      buildSummaryCards({
        total_versions: 7,
        draft_count: 1,
        sent_or_awaiting_count: 2,
        live_count: 3,
        pipeline_total: 4200,
      })
    ).toEqual([
      {
        label: 'Drafts',
        value: '1',
        displayValue: '1',
        subtext: '1 draft version',
        valueColor: 'var(--v2-ink)',
        subtextColor: 'var(--v2-ink-3)',
      },
      {
        label: 'Sent / Awaiting',
        value: '2',
        displayValue: '2',
        subtext: '2 versions attached to sent jobs',
        valueColor: 'var(--v2-ink)',
        subtextColor: 'var(--v2-ink-3)',
      },
      {
        label: 'Live Versions',
        value: '3',
        displayValue: '3',
        subtext: '3 live versions',
        valueColor: 'var(--v2-green-2)',
        subtextColor: 'var(--v2-green-2)',
      },
      {
        label: 'Pipeline',
        value: '$4,200',
        displayValue: '$4,200',
        subtext: 'Rollup-backed total',
        valueColor: 'var(--v2-amber)',
        subtextColor: 'var(--v2-ink-3)',
      },
    ])

    expect(buildSummaryCards(null)).toEqual([
      {
        label: 'Drafts',
        value: '0',
        displayValue: '0',
        subtext: '0 draft versions',
        valueColor: 'var(--v2-ink)',
        subtextColor: 'var(--v2-ink-3)',
      },
      {
        label: 'Sent / Awaiting',
        value: '0',
        displayValue: '0',
        subtext: '0 versions attached to sent jobs',
        valueColor: 'var(--v2-ink)',
        subtextColor: 'var(--v2-ink-3)',
      },
      {
        label: 'Live Versions',
        value: '0',
        displayValue: '0',
        subtext: '0 live versions',
        valueColor: 'var(--v2-green-2)',
        subtextColor: 'var(--v2-green-2)',
      },
      {
        label: 'Pipeline',
        value: '$0',
        displayValue: '$0',
        subtext: 'Rollup-backed total',
        valueColor: 'var(--v2-amber)',
        subtextColor: 'var(--v2-ink-3)',
      },
    ])
  })
})
