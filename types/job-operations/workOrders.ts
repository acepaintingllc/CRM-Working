import type { AcceptedEstimateOperationalSource } from './acceptedEstimateSource'
import type {
  JobColorSelectionCompleteness,
  JobColorSelectionRecord,
  JobColorSelectionSetRecord,
} from './colorSelections'

export type JobWorkOrderStatus = 'draft' | 'generated' | 'locked' | 'void'

export type JobWorkOrderRow = {
  id: string
  org_id: string
  job_id: string
  estimate_id: string
  estimate_snapshot_id: string
  color_selection_set_id: string | null
  revision_number: number
  status: JobWorkOrderStatus
  title: string
  work_order_number: string | null
  accepted_estimate_display_name: string | null
  customer_display_name: string | null
  job_display_name: string | null
  accepted_total: number
  change_order_total: number
  work_order_total: number
  document_json: JobWorkOrderDocument
  generated_snapshot_json?: JobWorkOrderDocument
  source_summary_json: JobWorkOrderSourceSummary
  generated_at: string | null
  locked_at: string | null
  issued_at?: string | null
  voided_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type JobWorkOrderChangeOrderDelta = {
  id: string
  change_order_number: string | null
  title: string | null
  description: string | null
  delta_total: number
  accepted_at: string | null
}

export type JobWorkOrderGenerationWarning = {
  code:
    | 'missing_color_selection_set'
    | 'color_selection_not_confirmed'
    | 'incomplete_color_selection'
  message: string
}

export type JobWorkOrderGenerateInput = {
  force_with_warnings: boolean
  crew_notes: string | null
  access_prep_notes: string | null
  special_notes: string | null
}

export type JobWorkOrderSourceSummary = {
  source_kind: 'accepted_estimate_work_order'
  source_version: 1
  org_id: string
  job_id: string
  estimate_id: string
  estimate_snapshot_id: string
  accepted_public_version_id: string
  color_selection_set_id: string | null
  color_selection_status: JobColorSelectionSetRecord['status'] | null
  color_selection_revision: number | null
  accepted_change_order_ids: string[]
  accepted_change_order_total: number
  warning_codes: JobWorkOrderGenerationWarning['code'][]
  generated_at: string
}

export type JobWorkOrderDocument = {
  kind: 'job_work_order'
  version: 1
  generated_at: string
  title: string
  revision_number: number
  status: JobWorkOrderStatus
  source: JobWorkOrderSourceSummary
  warnings: JobWorkOrderGenerationWarning[]
  customer: AcceptedEstimateOperationalSource['customer']
  job: AcceptedEstimateOperationalSource['job']
  estimate: AcceptedEstimateOperationalSource['estimate']
  acceptance: AcceptedEstimateOperationalSource['acceptance']
  totals: {
    accepted_total: number
    accepted_change_order_total: number
    work_order_total: number
    estimated_labor_hours: number
    estimated_paint_gallons: number
    estimated_supplies_cost: number
    estimated_access_cost: number
    estimated_other_cost: number
  }
  rooms: AcceptedEstimateOperationalSource['rooms']
  scopes: AcceptedEstimateOperationalSource['scopes']
  products: AcceptedEstimateOperationalSource['products']
  materials: AcceptedEstimateOperationalSource['materials']
  confirmed_colors: JobColorSelectionRecord[]
  color_completeness: JobColorSelectionCompleteness
  notes: {
    special_notes: string | null
    crew_notes: string | null
    access_prep_notes: string | null
    accepted_estimate_notes: AcceptedEstimateOperationalSource['notes']
  }
  change_order_deltas: JobWorkOrderChangeOrderDelta[]
}

export type JobWorkOrderReadModel = {
  current: JobWorkOrderRow | null
}
