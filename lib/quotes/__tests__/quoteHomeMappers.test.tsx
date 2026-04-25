import { describe, expect, it } from 'vitest'
import {
  decorateEstimateCollectionRows,
  toQuoteHomeSearchResultReadModel,
  toQuoteListEstimate,
  toQuoteHomeEligibleJobReadModel,
  toQuoteHomeJobVersionItem,
} from '../quoteHomeMappers'
import {
  QUOTE_HOME_FALLBACK_CUSTOMER_NAME,
  QUOTE_HOME_FALLBACK_JOB_TITLE,
  QUOTE_HOME_FALLBACK_VERSION_KIND,
  QUOTE_HOME_FALLBACK_VERSION_NAME,
  QUOTE_HOME_FALLBACK_VERSION_STATE,
} from '../quoteHomeTypes'

describe('quote home mappers', () => {
  it('decorates estimate rows with related job, customer, total, and sent status data', () => {
    const decorated = decorateEstimateCollectionRows(
      [
        {
          id: 'estimate-1',
          job_id: 'job-1',
          customer_id: 'customer-1',
          status: 'draft',
          version_name: ' Kitchen ',
          version_state: null,
          version_kind: null,
          version_sort_order: null,
          created_at: '2026-04-21T10:00:00.000Z',
          updated_at: '2026-04-22T10:00:00.000Z',
        },
      ],
      {
        jobs: [{ id: 'job-1', title: ' Kitchen repaint ', status: 'follow_up', estimate_sent_at: null }],
        customers: [{ id: 'customer-1', name: ' Taylor Smith ' }],
        rollups: [{ estimate_id: 'estimate-1', final_total: 1200 }],
      },
    )

    expect(toQuoteHomeJobVersionItem(decorated[0] ?? {})).toEqual(
      expect.objectContaining({
        estimate_id: 'estimate-1',
        version_name: 'Kitchen',
        version_state: QUOTE_HOME_FALLBACK_VERSION_STATE,
        version_kind: QUOTE_HOME_FALLBACK_VERSION_KIND,
        version_sort_order: 0,
        job_title: 'Kitchen repaint',
        customer_name: 'Taylor Smith',
        final_total: 1200,
        is_sent_estimate: true,
      }),
    )
  })

  it('normalizes malformed rows for list, search, and version read models', () => {
    const malformedRow = {
      id: 'estimate-from-id',
      job_id: 'job-9',
      customer_id: 'customer-9',
      status: 'draft',
      raw_version_name: '',
      raw_version_state: '',
      raw_version_kind: '',
      raw_version_sort_order: Number.NaN,
      version_name: '   ',
      version_state: '',
      version_kind: '',
      version_sort_order: Number.NaN,
      job_title: '',
      job_status: null,
      job_estimate_sent_at: null,
      customer_name: '',
      final_total: Number.NaN,
      updated_at: null,
      created_at: null,
      is_sent_estimate: true,
    }

    expect(toQuoteListEstimate(malformedRow)).toEqual(
      expect.objectContaining({
        id: 'estimate-from-id',
        version_name: '',
        version_state: '',
        version_kind: '',
        version_sort_order: null,
        job_title: QUOTE_HOME_FALLBACK_JOB_TITLE,
      }),
    )
    expect(toQuoteHomeSearchResultReadModel(malformedRow)).toEqual(
      expect.objectContaining({
        estimate_id: 'estimate-from-id',
        version_name: QUOTE_HOME_FALLBACK_VERSION_NAME,
        version_state: QUOTE_HOME_FALLBACK_VERSION_STATE,
        version_kind: QUOTE_HOME_FALLBACK_VERSION_KIND,
        customer_name: QUOTE_HOME_FALLBACK_CUSTOMER_NAME,
        final_total: null,
      }),
    )
    expect(toQuoteHomeJobVersionItem(malformedRow)).toEqual(
      expect.objectContaining({
        estimate_id: 'estimate-from-id',
        version_sort_order: 0,
        created_at: null,
      }),
    )
  })

  it('rejects ineligible jobs and normalizes eligible job display fields', () => {
    expect(
      toQuoteHomeEligibleJobReadModel({
        id: 'job-ineligible',
        customer_id: null,
        customer_name: null,
        customer_address: null,
        title: 'No customer',
        description: null,
        status: 'estimate_scheduled',
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
        version_count: 0,
      }),
    ).toBeNull()

    expect(
      toQuoteHomeEligibleJobReadModel({
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Taylor',
        customer_address: null,
        title: '',
        description: null,
        status: 'not-real',
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
        version_count: null,
      }),
    ).toEqual(expect.objectContaining({
      id: 'job-1',
      customer_id: 'customer-1',
      title: QUOTE_HOME_FALLBACK_JOB_TITLE,
      status: 'estimate_scheduled',
      version_count: 0,
    }))
  })
})
