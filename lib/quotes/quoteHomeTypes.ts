import type {
  EstimateCollectionCustomerRow,
  EstimateCollectionJobPageDbRow,
  EstimateCollectionJobRow,
  EstimateCollectionRollupRow,
  EstimateCollectionSearchDbRows,
  EstimateCollectionVersionRow,
} from '../server/estimate-collection/types'

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

export type EstimateCollectionDecoratedRowInput = Partial<EstimateCollectionDecoratedRow>

export const QUOTE_HOME_FALLBACK_VERSION_NAME = 'Quote Version'
export const QUOTE_HOME_FALLBACK_VERSION_STATE = 'draft'
export const QUOTE_HOME_FALLBACK_VERSION_KIND = 'standard'
export const QUOTE_HOME_FALLBACK_JOB_TITLE = 'Untitled job'
export const QUOTE_HOME_FALLBACK_CUSTOMER_NAME = 'Unknown customer'

export type EstimateCollectionRowRelations = {
  jobs: EstimateCollectionJobRow[]
  customers: EstimateCollectionCustomerRow[]
  rollups: EstimateCollectionRollupRow[]
}

export type QuoteHomeJobsPageRows = {
  query: string
  limit: number
  rows: EstimateCollectionJobPageDbRow[]
}

export type QuoteHomeSearchRows = EstimateCollectionSearchDbRows & {
  limit: number
}

export const QUOTE_HOME_SEARCH_SOURCE_RANK = {
  version: 0,
  job: 1,
  customer: 2,
} as const

export const QUOTE_HOME_SEARCH_SORT_POLICY = [
  'source rank ascending',
  'updated_at descending',
  'id descending',
] as const

export type QuoteHomeSearchSource = keyof typeof QUOTE_HOME_SEARCH_SOURCE_RANK

export type QuoteHomeSearchCandidate = {
  row: EstimateCollectionVersionRow
  source: QuoteHomeSearchSource
  rank: number
}

export const quoteHomeDefaultPageLimit = 25
export const quoteHomeMaxPageLimit = 100

export type QuoteHomeCursorKey = {
  timestamp: string | null
  id: string
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

export type QuoteCreateJobEligibilityReason = 'eligible' | 'missing_customer'

export type QuoteCreateJobReadModel = {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  title: string
  eligibility: {
    eligible: boolean
    reason: QuoteCreateJobEligibilityReason
  }
}

export type QuoteCreateJobContextReadModel = {
  job: QuoteCreateJobReadModel
}
