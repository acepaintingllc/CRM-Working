export type EstimateCollectionVersionCopy = {
  createdNotice: string
  defaultVersionLabel: string
}

export type EstimateCollectionVersionRow = {
  id: string
  job_id: string
  customer_id: string
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

export type EstimateCollectionJobRow = {
  id: string
  title?: string | null
  status: string | null
  estimate_sent_at?: string | null
}

export type EstimateCollectionCustomerRow = {
  id: string
  name: string | null
}

export type EstimateCollectionRollupRow = {
  estimate_id: string
  final_total: number | null
}

export type EstimateCollectionRelatedRows = {
  jobs: EstimateCollectionJobRow[]
  customers: EstimateCollectionCustomerRow[]
  rollups: EstimateCollectionRollupRow[]
}

export type QuoteHomeSummaryRow = {
  total_versions: number | null
  draft_count: number | null
  sent_or_awaiting_count: number | null
  live_count: number | null
  pipeline_total: number | null
}

export type QuoteHomeJobsPageRow = {
  id: string
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  title: string | null
  description: string | null
  status: string | null
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
  version_count: number | null
}
