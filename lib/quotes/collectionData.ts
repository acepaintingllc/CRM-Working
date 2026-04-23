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

export type QuoteHomeJobVersionCountsReadModel = {
  items: Array<{
    job_id: string
    version_count: number
  }>
}

export type QuoteHomeEligibleJobReadModel = {
  id: string
  customer_id: string
  customer_name: string | null
  customer_address: string | null
  title: string
  description: string | null
  status: string
  created_at?: string | null
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  scheduled_end_date?: string | null
  scheduled_email_sent_at?: string | null
  completed_at: string | null
  completed_email_sent_at?: string | null
  closeout_notes?: string | null
  linked_estimate_id?: string | null
}

export type QuoteHomeBootstrapReadModel = {
  summary: QuoteHomeSummaryReadModel
  jobCounts: QuoteHomeJobVersionCountsReadModel
  jobs: QuoteHomeEligibleJobReadModel[]
}

export type QuoteJobVersionsReadModel = {
  job_id: string
  total_versions: number
  items: QuoteHomeJobVersionItemReadModel[]
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

export function buildQuoteHomeSearchHaystack(
  estimate:
    | QuoteHomeRecentActivityItemReadModel
    | QuoteHomeJobVersionItemReadModel
    | QuoteHomeSearchResultReadModel
) {
  return `${estimate.version_name} ${estimate.job_title} ${estimate.customer_name} ${estimate.version_kind} ${estimate.version_state}`.toLowerCase()
}

export function buildQuoteHomeJobVersionCountsReadModel(
  estimates: Array<Pick<EstimateCollectionDecoratedRow, 'job_id'>>
): QuoteHomeJobVersionCountsReadModel {
  const counts = estimates.reduce<Record<string, number>>((nextCounts, estimate) => {
    nextCounts[estimate.job_id] = (nextCounts[estimate.job_id] ?? 0) + 1
    return nextCounts
  }, {})

  return {
    items: Object.entries(counts).map(([job_id, version_count]) => ({
      job_id,
      version_count,
    })),
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

export function buildQuoteHomeBootstrapReadModel(
  rows: EstimateCollectionDecoratedRow[],
  jobs: QuoteHomeEligibleJobReadModel[]
): QuoteHomeBootstrapReadModel {
  return {
    summary: buildQuoteHomeSummaryReadModel(
      rows.map((row) => ({
        version_state: row.version_state,
        final_total: row.final_total,
        is_sent_estimate: row.is_sent_estimate,
      }))
    ),
    jobCounts: buildQuoteHomeJobVersionCountsReadModel(rows),
    jobs,
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
  const normalizedQuery = query.trim().toLowerCase()
  return {
    query,
    items:
      normalizedQuery.length === 0
        ? []
        : rows
            .map(toQuoteHomeSearchResultReadModel)
            .filter((estimate) => buildQuoteHomeSearchHaystack(estimate).includes(normalizedQuery))
            .slice(0, 8),
  }
}

export function buildQuoteListPayload(rows: EstimateCollectionDecoratedRow[]) {
  return {
    estimates: rows.map(toQuoteListEstimate),
  }
}

export function buildQuoteJobVersionsReadModel(
  rows: EstimateCollectionDecoratedRow[],
  jobId: string
): QuoteJobVersionsReadModel {
  const items = rows
    .map(toQuoteHomeJobVersionItem)
    .filter((estimate) => estimate.job_id === jobId)
  return {
    job_id: jobId,
    total_versions: items.length,
    items,
  }
}
