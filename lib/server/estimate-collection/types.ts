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
