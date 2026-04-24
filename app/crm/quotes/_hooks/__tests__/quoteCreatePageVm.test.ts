import { describe, expect, it } from 'vitest'
import type { QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import { EMPTY_QUOTE_CREATE_RESOURCE } from '../quoteCreatePagePolicy'
import { buildQuoteCreatePageVm } from '../quoteCreatePageVm'

const versionItem: QuoteHomeJobVersionItemReadModel = {
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

function buildVm(
  overrides: Partial<Parameters<typeof buildQuoteCreatePageVm>[0]> = {}
): ReturnType<typeof buildQuoteCreatePageVm> {
  return buildQuoteCreatePageVm({
    jobId: 'job-1',
    shouldLoadJobData: true,
    resource: {
      data: EMPTY_QUOTE_CREATE_RESOURCE,
      loading: false,
      error: null,
    },
    workflow: {
      versions: {
        items: [],
        loading: false,
        error: null,
      },
      create: {
        error: null,
        versionName: '',
        versionKind: 'standard',
        creating: false,
        canCreate: false,
      },
    },
    ...overrides,
  })
}

describe('buildQuoteCreatePageVm', () => {
  it('represents a missing job query as idle and disabled', () => {
    const vm = buildVm({
      jobId: '',
      shouldLoadJobData: false,
    })

    expect(vm.feedback.loading).toBe(false)
    expect(vm.feedback.shouldLoadJobData).toBe(false)
    expect(vm.job.title).toBe('Unknown job')
    expect(vm.create.canCreate).toBe(false)
  })

  it('builds eligible job display state and preserves create controls', () => {
    const vm = buildVm({
      resource: {
        loading: false,
        error: null,
        data: {
          job: {
            id: 'job-1',
            customer_id: 'customer-1',
            customer_name: 'Alice',
            customer_address: '123 Main',
            title: 'Kitchen',
            eligibility: { eligible: true, reason: 'eligible' },
          },
          selectedJob: {
            id: 'job-1',
            customer_id: 'customer-1',
            customer_name: 'Alice',
            customer_address: '123 Main',
            title: 'Kitchen',
            eligibility: { eligible: true, reason: 'eligible' },
          },
        },
      },
      workflow: {
        versions: {
          items: [versionItem],
          loading: false,
          error: null,
        },
        create: {
          error: null,
          versionName: 'Custom',
          versionKind: 'revision',
          creating: false,
          canCreate: true,
        },
      },
    })

    expect(vm.feedback.hasLoadedJobData).toBe(true)
    expect(vm.job).toMatchObject({
      title: 'Kitchen',
      customerLine: 'Alice \u00b7 123 Main',
      jobHref: '/crm/jobs/job-1',
      hasJob: true,
      isEligible: true,
    })
    expect(vm.versions.hasVersions).toBe(true)
    expect(vm.create).toMatchObject({
      versionName: 'Custom',
      versionKind: 'revision',
      canCreate: true,
    })
  })

  it('keeps load errors ahead of create errors in the page banner', () => {
    const vm = buildVm({
      resource: {
        data: EMPTY_QUOTE_CREATE_RESOURCE,
        loading: false,
        error: 'Load failed',
      },
      workflow: {
        versions: {
          items: [],
          loading: false,
          error: null,
        },
        create: {
          error: 'Select a job before creating a version.',
          versionName: '',
          versionKind: 'standard',
          creating: false,
          canCreate: false,
        },
      },
    })

    expect(vm.feedback.pageBanner?.message).toBe('Load failed')
    expect(vm.feedback.actionError).toBe('Select a job before creating a version.')
  })
})
