import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobListItemReadModel,
  QuoteHomeJobVersionItemReadModel,
  QuoteHomeSearchResultReadModel,
  QuoteHomeSummaryReadModel,
  QuoteJobVersionsPageReadModel,
} from '@/lib/quotes/collectionData'

export const quoteHomeSummary: QuoteHomeSummaryReadModel = {
  total_versions: 3,
  draft_count: 1,
  sent_or_awaiting_count: 1,
  live_count: 1,
  pipeline_total: 1800,
}

export function makeQuoteHomeJob(
  id: string,
  overrides: Partial<QuoteHomeJobListItemReadModel> = {}
): QuoteHomeJobListItemReadModel {
  const index = Number(id.match(/\d+$/)?.[0] ?? 1)

  return {
    id,
    customer_id: `customer-${index}`,
    customer_name: index === 1 ? 'Alice' : index === 2 ? 'Bob' : 'Charlie',
    customer_address: index === 1 ? '123 Main' : index === 2 ? '456 Oak' : '789 Pine',
    title: index === 1 ? 'Kitchen' : index === 2 ? 'Garage' : 'Bath',
    description: null,
    status: index === 2 ? 'estimate_sent' : 'estimate_pending',
    created_at: `2026-04-${22 - index}T10:00:00.000Z`,
    estimate_date: null,
    estimate_sent_at: null,
    scheduled_date: null,
    scheduled_end_date: null,
    scheduled_email_sent_at: null,
    completed_at: null,
    completed_email_sent_at: null,
    closeout_notes: null,
    linked_estimate_id: null,
    version_count: index === 1 ? 2 : 1,
    ...overrides,
  }
}

export const quoteHomeJobs = [
  makeQuoteHomeJob('job-1'),
  makeQuoteHomeJob('job-2'),
] satisfies QuoteHomeJobListItemReadModel[]

export const quoteHomeJobThree = makeQuoteHomeJob('job-3')

export function makeQuoteHomeVersion(
  estimateId: string,
  overrides: Partial<QuoteHomeJobVersionItemReadModel> = {}
): QuoteHomeJobVersionItemReadModel {
  const index = Number(estimateId.match(/\d+$/)?.[0] ?? 1)
  const jobId = overrides.job_id ?? (index === 3 ? 'job-2' : 'job-1')
  const customerIndex = jobId === 'job-2' ? 2 : 1

  return {
    estimate_id: estimateId,
    job_id: jobId,
    customer_id: `customer-${customerIndex}`,
    version_name: index === 1 ? 'Version A' : index === 2 ? 'Version B' : 'Garage Alt',
    version_state: index === 1 ? 'draft' : index === 2 ? 'live' : 'archived',
    version_kind: index === 1 ? 'standard' : index === 2 ? 'revision' : 'alternate',
    version_sort_order: index === 1 ? 1 : 2,
    job_title: jobId === 'job-2' ? 'Garage' : 'Kitchen',
    customer_name: customerIndex === 1 ? 'Alice' : 'Bob',
    final_total: index === 1 ? 500 : index === 2 ? 1300 : 800,
    updated_at: `2026-04-${22 - index}T10:00:00.000Z`,
    created_at: `2026-04-${21 - index}T10:00:00.000Z`,
    is_sent_estimate: index !== 1,
    ...overrides,
  }
}

export const quoteHomeJob1Versions: QuoteJobVersionsPageReadModel = {
  job_id: 'job-1',
  total_versions: 2,
  limit: 25,
  next_cursor: null,
  items: [
    makeQuoteHomeVersion('estimate-2'),
    makeQuoteHomeVersion('estimate-1'),
  ],
}

export const quoteHomeJob2Versions: QuoteJobVersionsPageReadModel = {
  job_id: 'job-2',
  total_versions: 1,
  limit: 25,
  next_cursor: null,
  items: [makeQuoteHomeVersion('estimate-3')],
}

export const quoteHomeBootstrap: QuoteHomeBootstrapReadModel = {
  summary: quoteHomeSummary,
  jobs: {
    query: '',
    limit: 25,
    next_cursor: 'cursor-2',
    items: quoteHomeJobs,
  },
  selected_job_id: 'job-1',
  selected_job_versions: quoteHomeJob1Versions,
}

export const quoteHomeEmptyBootstrap: QuoteHomeBootstrapReadModel = {
  summary: {
    total_versions: 0,
    draft_count: 0,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 0,
  },
  jobs: {
    query: '',
    limit: 25,
    next_cursor: null,
    items: [],
  },
  selected_job_id: null,
  selected_job_versions: null,
}

export function makeQuoteHomeSearchResult(
  estimateId: string,
  overrides: Partial<QuoteHomeSearchResultReadModel> = {}
): QuoteHomeSearchResultReadModel {
  const version = makeQuoteHomeVersion(estimateId, overrides)

  return {
    estimate_id: version.estimate_id,
    job_id: version.job_id,
    customer_id: version.customer_id,
    version_name: version.version_name,
    version_state: version.version_state,
    version_kind: version.version_kind,
    job_title: version.job_title,
    customer_name: version.customer_name,
    updated_at: version.updated_at,
    final_total: version.final_total,
    is_sent_estimate: version.is_sent_estimate,
    ...overrides,
  }
}

export function makePagedQuoteHomeVersions(params: {
  jobId?: string
  count: number
  totalVersions?: number
  nextCursor?: string | null
  startAt?: number
}): QuoteJobVersionsPageReadModel {
  const jobId = params.jobId ?? 'job-1'
  const startAt = params.startAt ?? 1

  return {
    job_id: jobId,
    total_versions: params.totalVersions ?? params.count,
    limit: 25,
    next_cursor: params.nextCursor ?? null,
    items: Array.from({ length: params.count }, (_, index) => {
      const versionNumber = startAt + index
      return makeQuoteHomeVersion(`estimate-${versionNumber}`, {
        job_id: jobId,
        version_name: `Version ${versionNumber}`,
        version_sort_order: params.count - index,
      })
    }),
  }
}
