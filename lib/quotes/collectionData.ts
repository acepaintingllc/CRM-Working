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

export type QuoteHomeEstimate = {
  estimate_id: string
  job_id: string
  customer_id: string
  version_name: string
  version_state: string
  version_kind: string
  version_sort_order: number
  job_title: string
  customer_name: string
  final_total: number | null
  updated_at: string | null
  created_at: string | null
  is_sent_estimate: boolean
}

export type QuoteHomeSummary = {
  draft_count: number
  sent_or_awaiting_count: number
  live_count: number
  pipeline_total: number
}

export type QuoteHomeData = {
  summary: QuoteHomeSummary
  recent_estimates: QuoteHomeEstimate[]
  snapshot: (QuoteHomeEstimate & { total_versions: number }) | null
  search_estimates: QuoteHomeEstimate[]
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

export function toQuoteHomeEstimate(row: EstimateCollectionDecoratedRow): QuoteHomeEstimate {
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

export function buildQuoteHomeSummary(estimates: QuoteHomeEstimate[]): QuoteHomeSummary {
  return {
    draft_count: estimates.filter((row) => row.version_state === 'draft').length,
    sent_or_awaiting_count: estimates.filter((row) => row.is_sent_estimate).length,
    live_count: estimates.filter((row) => row.version_state === 'live').length,
    pipeline_total: estimates.reduce((sum, row) => {
      if (row.version_state === 'archived') return sum
      return sum + (row.final_total ?? 0)
    }, 0),
  }
}

export function buildQuoteHomeSnapshot(
  estimates: QuoteHomeEstimate[],
  totalVersions = estimates.length
): QuoteHomeData['snapshot'] {
  const latestEstimate = estimates[0] ?? null
  if (!latestEstimate) return null
  return {
    ...latestEstimate,
    total_versions: totalVersions,
  }
}

export function buildQuoteListPayload(rows: EstimateCollectionDecoratedRow[]) {
  return {
    estimates: rows.map(toQuoteListEstimate),
  }
}

export function buildQuoteHomeData(rows: EstimateCollectionDecoratedRow[]): QuoteHomeData {
  const estimates = rows.map(toQuoteHomeEstimate)
  return {
    summary: buildQuoteHomeSummary(estimates),
    recent_estimates: estimates.slice(0, 12),
    snapshot: buildQuoteHomeSnapshot(estimates, rows.length),
    search_estimates: estimates.slice(0, 200),
  }
}

export function removeQuoteEstimateFromHomeData(
  data: QuoteHomeData,
  estimateId: string
): QuoteHomeData {
  const remainingSearch = data.search_estimates.filter((row) => row.estimate_id !== estimateId)
  return {
    ...data,
    summary: buildQuoteHomeSummary(remainingSearch),
    recent_estimates: remainingSearch.slice(0, 12),
    snapshot: buildQuoteHomeSnapshot(remainingSearch),
    search_estimates: remainingSearch,
  }
}
