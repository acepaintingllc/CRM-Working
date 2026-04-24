import { describe, expect, it } from 'vitest'
import type {
  QuoteHomeJobListItemReadModel,
  QuoteHomeJobVersionItemReadModel,
} from '@/lib/quotes/collectionData'
import {
  buildHeroSummaryText,
  buildQuoteHomeVersionItemVm,
  buildQuotesHomeFeedbackVm,
  buildQuotesHomeSelectedJobVm,
  buildSearchResultVm,
  buildSummaryCards,
  QUOTE_META_SEPARATOR,
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
    ).toBe(
      `24 total versions${QUOTE_META_SEPARATOR}2 drafts${QUOTE_META_SEPARATOR}3 sent/awaiting${QUOTE_META_SEPARATOR}1 live`
    )
  })

  it('builds selected-job and version item view models', () => {
    const selectedVm = buildQuotesHomeSelectedJobVm(job, 4, false)
    expect(selectedVm.title).toBe('Kitchen')
    expect(selectedVm.customerLine).toBe(`Alice${QUOTE_META_SEPARATOR}123 Main`)
    expect(selectedVm.stats).toEqual([
      { label: 'Customer', value: 'Alice' },
      { label: 'Job Status', value: 'Estimate Sent' },
      { label: 'Versions', value: '4' },
    ])

    const versionVm = buildQuoteHomeVersionItemVm(estimate, 'estimate-1')
    expect(versionVm.total).toBe('$1,250')
    expect(versionVm.href).toBe('/crm/quotes/estimate-1')
    expect(versionVm.deleting).toBe(true)
    expect(versionVm.meta).toContain(
      `Live / Revision${QUOTE_META_SEPARATOR}Updated`
    )
  })

  it('builds search result view models from shared home version items', () => {
    expect(buildSearchResultVm(estimate)).toEqual({
      id: 'estimate-1',
      href: '/crm/quotes/estimate-1',
      title: 'Kitchen Revision',
      meta: 'Kitchen\nAlice / Live',
    })
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
      { label: 'Drafts', value: '0', subtext: '0 draft versions' },
      {
        label: 'Sent / Awaiting',
        value: '0',
        subtext: '0 versions attached to sent jobs',
      },
      {
        label: 'Live Versions',
        value: '0',
        subtext: '0 live versions',
        valueColor: 'var(--v2-green-2)',
        subtextColor: 'var(--v2-green-2)',
      },
      {
        label: 'Pipeline',
        value: '$0',
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
      { label: 'Drafts', value: '1', subtext: '1 draft version' },
      {
        label: 'Sent / Awaiting',
        value: '2',
        subtext: '2 versions attached to sent jobs',
      },
      {
        label: 'Live Versions',
        value: '3',
        subtext: '3 live versions',
        valueColor: 'var(--v2-green-2)',
        subtextColor: 'var(--v2-green-2)',
      },
      {
        label: 'Pipeline',
        value: '$4,200',
        subtext: 'Rollup-backed total',
        valueColor: 'var(--v2-amber)',
        subtextColor: 'var(--v2-ink-3)',
      },
    ])

    expect(buildSummaryCards(null)).toEqual([
      { label: 'Drafts', value: '0', subtext: '0 draft versions' },
      {
        label: 'Sent / Awaiting',
        value: '0',
        subtext: '0 versions attached to sent jobs',
      },
      {
        label: 'Live Versions',
        value: '0',
        subtext: '0 live versions',
        valueColor: 'var(--v2-green-2)',
        subtextColor: 'var(--v2-green-2)',
      },
      {
        label: 'Pipeline',
        value: '$0',
        subtext: 'Rollup-backed total',
        valueColor: 'var(--v2-amber)',
        subtextColor: 'var(--v2-ink-3)',
      },
    ])
  })
})
