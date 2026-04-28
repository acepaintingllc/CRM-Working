import { describe, expect, it } from 'vitest'
import { buildQuoteHomePageVmResources } from '../quoteHomePageVmResources'

const job = {
  id: 'job-1',
  customer_id: 'customer-1',
  customer_name: 'Alice',
  customer_address: '123 Main',
  title: 'Kitchen',
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
  version_count: 1,
}

const version = {
  estimate_id: 'estimate-1',
  job_id: 'job-1',
  customer_id: 'customer-1',
  version_name: 'Version A',
  version_state: 'draft',
  version_kind: 'standard',
  version_sort_order: 1,
  job_title: 'Kitchen',
  customer_name: 'Alice',
  final_total: 500,
  updated_at: '2026-04-20T10:00:00.000Z',
  created_at: '2026-04-19T10:00:00.000Z',
  is_sent_estimate: false,
}

describe('buildQuoteHomePageVmResources', () => {
  it('maps hook resources into the quote home VM resource contract', () => {
    expect(
      buildQuoteHomePageVmResources({
        home: {
          summary: {
            total_versions: 1,
            draft_count: 1,
            sent_or_awaiting_count: 0,
            live_count: 0,
            pipeline_total: 500,
          },
          latestVersion: version,
          jobs: [job],
          hasMore: true,
          jobsLoading: false,
          loading: false,
          bootstrapError: null,
          jobsError: null,
        },
        search: {
          query: 'version',
          loading: false,
          error: null,
          results: [
            {
              estimate_id: 'estimate-1',
              version_name: 'Version A',
              version_state: 'draft',
              job_title: 'Kitchen',
              customer_name: 'Alice',
            },
          ],
        },
        versions: {
          items: [version],
          error: null,
          totalVersions: 1,
          hasMore: false,
          loadingMore: false,
          hasResolved: true,
        },
        create: {
          creating: false,
          error: null,
          versionName: 'Version A',
          versionKind: 'standard',
          canCreate: true,
        },
        delete: {
          confirmingDelete: version,
          deletingId: 'estimate-1',
          error: null,
        },
      })
    ).toEqual({
      home: {
        summary: {
          total_versions: 1,
          draft_count: 1,
          sent_or_awaiting_count: 0,
          live_count: 0,
          pipeline_total: 500,
        },
        latestVersion: version,
        jobs: [job],
        hasMore: true,
        jobsLoading: false,
        loading: false,
        bootstrapError: null,
        jobsError: null,
      },
      search: {
        query: 'version',
        loading: false,
        error: null,
        results: [
          {
            estimate_id: 'estimate-1',
            version_name: 'Version A',
            version_state: 'draft',
            job_title: 'Kitchen',
            customer_name: 'Alice',
          },
        ],
      },
      workflow: {
        versions: {
          items: [version],
          error: null,
          totalVersions: 1,
          hasMore: false,
          loadingMore: false,
          hasResolved: true,
        },
        create: {
          creating: false,
          error: null,
          versionName: 'Version A',
          versionKind: 'standard',
          canCreate: true,
        },
      },
      delete: {
        confirmingDelete: version,
        deletingId: 'estimate-1',
        error: null,
      },
    })
  })
})
