export type EstimateCollectionDecoratedRow = {
  id: string
  estimate_id: string
  job_id: string
  customer_id: string
  status: string | null
  raw_version_name: string | null
  raw_version_state: string | null
  raw_version_kind: string | null
  raw_version_sort_order: number | null
  version_name: string
  version_state: string
  version_kind: string
  version_sort_order: number
  job_title: string
  job_status: string | null
  job_estimate_sent_at: string | null
  customer_name: string
  final_total: number | null
  updated_at: string | null
  created_at: string | null
  is_sent_estimate: boolean
}

export type QuoteListEstimate = {
  id: string
  job_id: string
  customer_id: string
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  updated_at: string | null
  created_at: string | null
  job_title: string
  job_status: string | null
  job_estimate_sent_at: string | null
  is_sent_estimate: boolean
  customer_name: string
}

type QuoteHomeVersionIdentity = {
  estimate_id: string
  job_id: string
  version_name: string
  version_state: string
  version_kind: string
  job_title: string
  customer_name: string
}

export type QuoteHomeRecentActivityItemReadModel = QuoteHomeVersionIdentity & {
  final_total: number | null
  updated_at: string | null
  is_sent_estimate: boolean
}

export type QuoteHomeJobVersionItemReadModel = QuoteHomeVersionIdentity & {
  customer_id: string
  version_sort_order: number
  final_total: number | null
  updated_at: string | null
  created_at: string | null
  is_sent_estimate: boolean
}

export type QuoteHomeSummaryReadModel = {
  total_versions: number
  draft_count: number
  sent_or_awaiting_count: number
  live_count: number
  pipeline_total: number
}

export type QuoteHomeRecentActivityReadModel = {
  items: QuoteHomeRecentActivityItemReadModel[]
}

export type QuoteHomeSearchResultReadModel = {
  estimate_id: string
  job_id: string
  customer_id: string
  version_name: string
  version_state: string
  version_kind: string
  job_title: string
  customer_name: string
  updated_at: string | null
  final_total: number | null
  is_sent_estimate: boolean
}

export type QuoteHomeEligibleJobReadModel = {
  id: string
  customer_id: string
  customer_name: string | null
  customer_address: string | null
  title: string
  description: string | null
  status: string
  created_at: string | null
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  scheduled_end_date: string | null
  scheduled_email_sent_at: string | null
  completed_at: string | null
  completed_email_sent_at: string | null
  closeout_notes: string | null
  linked_estimate_id: string | null
}

export type QuoteHomeJobListItemReadModel = QuoteHomeEligibleJobReadModel & {
  version_count: number
}

export type QuoteHomeJobsPageReadModel = {
  query: string
  limit: number
  next_cursor: string | null
  items: QuoteHomeJobListItemReadModel[]
}

export type QuoteJobVersionsReadModel = {
  job_id: string
  total_versions: number
  items: QuoteHomeJobVersionItemReadModel[]
}

export type QuoteJobVersionsPageReadModel = QuoteJobVersionsReadModel & {
  limit: number
  next_cursor: string | null
}

export type QuoteHomeBootstrapReadModel = {
  summary: QuoteHomeSummaryReadModel
  jobs: QuoteHomeJobsPageReadModel
  selected_job_id: string | null
  selected_job_versions: QuoteJobVersionsPageReadModel | null
}

export type QuoteHomeSearchResponse = {
  query: string
  items: QuoteHomeSearchResultReadModel[]
}

export function toQuoteListEstimate(row: EstimateCollectionDecoratedRow): QuoteListEstimate {
  return {
    id: row.id,
    job_id: row.job_id,
    customer_id: row.customer_id,
    status: row.status,
    version_name: row.raw_version_name,
    version_state: row.raw_version_state,
    version_kind: row.raw_version_kind,
    version_sort_order: row.raw_version_sort_order,
    updated_at: row.updated_at,
    created_at: row.created_at,
    job_title: row.job_title,
    job_status: row.job_status,
    job_estimate_sent_at: row.job_estimate_sent_at,
    is_sent_estimate: row.is_sent_estimate,
    customer_name: row.customer_name,
  }
}

export function toQuoteHomeRecentActivityItem(
  row: EstimateCollectionDecoratedRow
): QuoteHomeRecentActivityItemReadModel {
  return {
    estimate_id: row.estimate_id,
    job_id: row.job_id,
    version_name: row.version_name,
    version_state: row.version_state,
    version_kind: row.version_kind,
    job_title: row.job_title,
    customer_name: row.customer_name,
    final_total: row.final_total,
    updated_at: row.updated_at,
    is_sent_estimate: row.is_sent_estimate,
  }
}

export function toQuoteHomeJobVersionItem(
  row: EstimateCollectionDecoratedRow
): QuoteHomeJobVersionItemReadModel {
  return {
    estimate_id: row.estimate_id,
    job_id: row.job_id,
    customer_id: row.customer_id,
    version_name: row.version_name,
    version_state: row.version_state,
    version_kind: row.version_kind,
    version_sort_order: row.version_sort_order,
    job_title: row.job_title,
    customer_name: row.customer_name,
    final_total: row.final_total,
    updated_at: row.updated_at,
    created_at: row.created_at,
    is_sent_estimate: row.is_sent_estimate,
  }
}

export function toQuoteHomeSearchResultReadModel(
  row: EstimateCollectionDecoratedRow
): QuoteHomeSearchResultReadModel {
  return {
    estimate_id: row.estimate_id,
    job_id: row.job_id,
    customer_id: row.customer_id,
    version_name: row.version_name,
    version_state: row.version_state,
    version_kind: row.version_kind,
    job_title: row.job_title,
    customer_name: row.customer_name,
    updated_at: row.updated_at,
    final_total: row.final_total,
    is_sent_estimate: row.is_sent_estimate,
  }
}

export function buildQuoteHomeSummaryReadModel(
  estimates: Array<
    Pick<
      QuoteHomeJobVersionItemReadModel,
      'version_state' | 'final_total' | 'is_sent_estimate'
    >
  >
): QuoteHomeSummaryReadModel {
  return {
    total_versions: estimates.length,
    draft_count: estimates.filter((row) => row.version_state === 'draft').length,
    sent_or_awaiting_count: estimates.filter((row) => row.is_sent_estimate).length,
    live_count: estimates.filter((row) => row.version_state === 'live').length,
    pipeline_total: estimates.reduce((sum, row) => {
      if (row.version_state === 'archived') return sum
      return sum + (row.final_total ?? 0)
    }, 0),
  }
}

export function buildQuoteHomeBootstrapReadModel(params: {
  summary: QuoteHomeSummaryReadModel
  jobs: QuoteHomeJobsPageReadModel
  selectedJobVersions: QuoteJobVersionsPageReadModel | null
}): QuoteHomeBootstrapReadModel {
  return {
    summary: params.summary,
    jobs: params.jobs,
    selected_job_id: params.selectedJobVersions?.job_id ?? params.jobs.items[0]?.id ?? null,
    selected_job_versions: params.selectedJobVersions,
  }
}

export function buildQuoteHomeRecentActivityReadModel(
  rows: EstimateCollectionDecoratedRow[]
): QuoteHomeRecentActivityReadModel {
  return {
    items: rows.map(toQuoteHomeRecentActivityItem).slice(0, 12),
  }
}

export function buildQuoteHomeSearchReadModel(
  rows: EstimateCollectionDecoratedRow[],
  query: string
): QuoteHomeSearchResponse {
  return {
    query,
    items: rows.map(toQuoteHomeSearchResultReadModel),
  }
}

export function buildQuoteHomeJobsPageReadModel(params: {
  query: string
  limit: number
  nextCursor: string | null
  items: QuoteHomeJobListItemReadModel[]
}): QuoteHomeJobsPageReadModel {
  return {
    query: params.query,
    limit: params.limit,
    next_cursor: params.nextCursor,
    items: params.items,
  }
}

export function buildQuoteListPayload(rows: EstimateCollectionDecoratedRow[]) {
  return {
    estimates: rows.map(toQuoteListEstimate),
  }
}

export function buildQuoteJobVersionsReadModel(
  rows: EstimateCollectionDecoratedRow[],
  params: {
    jobId: string
    totalVersions: number
    limit: number
    nextCursor: string | null
  }
): QuoteJobVersionsPageReadModel {
  return {
    job_id: params.jobId,
    total_versions: params.totalVersions,
    limit: params.limit,
    next_cursor: params.nextCursor,
    items: rows
      .map(toQuoteHomeJobVersionItem)
      .filter((estimate) => estimate.job_id === params.jobId),
  }
}
