export const jobReviewCauseTagOptions = [
  { value: 'scope_missed', label: 'Scope missed' },
  { value: 'production_rate', label: 'Production rate' },
  { value: 'material_usage', label: 'Material usage' },
  { value: 'change_order', label: 'Change order' },
  { value: 'data_entry', label: 'Data entry' },
  { value: 'other', label: 'Other' },
] as const

export type JobReviewPrimaryCauseTag = (typeof jobReviewCauseTagOptions)[number]['value']

export const jobReviewPrimaryCauseTags = jobReviewCauseTagOptions.map(
  (option) => option.value
) as readonly JobReviewPrimaryCauseTag[]

export function isJobReviewPrimaryCauseTag(
  value: string
): value is JobReviewPrimaryCauseTag {
  return (jobReviewPrimaryCauseTags as readonly string[]).includes(value)
}

export const jobReviewDataQualityOptions = [
  { value: 'valid', label: 'Valid' },
  { value: 'questionable', label: 'Questionable' },
  { value: 'invalid', label: 'Invalid' },
] as const

export type JobReviewDataQualityStatus =
  (typeof jobReviewDataQualityOptions)[number]['value']

export const jobReviewDataQualityStatuses = jobReviewDataQualityOptions.map(
  (option) => option.value
) as readonly JobReviewDataQualityStatus[]

export function isJobReviewDataQualityStatus(
  value: string
): value is JobReviewDataQualityStatus {
  return (jobReviewDataQualityStatuses as readonly string[]).includes(value)
}

export type JobActualsStatus = 'draft' | 'submitted' | 'locked'

export type JobActualsRecord = {
  id: string
  org_id: string
  job_id: string
  estimate_snapshot_id: string
  actual_labor_hours: number
  actual_paint_gallons: number
  actual_supplies_cost: number
  actual_other_cost: number
  notes: string | null
  status: JobActualsStatus
  submitted_at: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type JobActualsDraftPayload = {
  estimate_snapshot_id: string
  actual_labor_hours: number
  actual_paint_gallons: number
  actual_supplies_cost: number
  actual_other_cost: number
  notes?: string | null
}

export type JobReviewStatus = 'draft' | 'reviewed' | 'locked'
export type JobReviewMetricKey = 'labor' | 'paint' | 'supplies' | 'other'
export type JobReviewMetricUnit = 'hours' | 'gallons' | 'currency'

export type JobReviewRecord = {
  id: string
  org_id: string
  job_id: string
  estimate_snapshot_id: string
  job_actuals_id: string
  primary_cause_tag: JobReviewPrimaryCauseTag | null
  review_notes: string | null
  status: JobReviewStatus
  exclude_from_trends: boolean
  data_quality_status: JobReviewDataQualityStatus
  change_order_present: boolean
  trend_eligible: boolean
  reviewed_at: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type JobReviewMetricRecord = {
  id?: string
  org_id: string
  job_id: string
  estimate_snapshot_id: string
  job_review_id: string
  metric_key: JobReviewMetricKey
  metric_label: string
  unit: JobReviewMetricUnit
  estimated_value: number
  actual_value: number
  variance_value: number
  total_impact: number
  variance_percent: number | null
  tolerance_percent: number
  within_tolerance: boolean
  created_at?: string
  updated_at?: string
}

export type JobReviewTrendEligibilityPreview = {
  included: Record<JobReviewDataQualityStatus, boolean>
  excluded: Record<JobReviewDataQualityStatus, boolean>
}

export type JobReviewReadModel = {
  review: JobReviewRecord | null
  metrics: JobReviewMetricRecord[]
  trend_eligible: boolean
  trend_eligibility_preview: JobReviewTrendEligibilityPreview
}

export type JobReviewPayload = {
  estimate_snapshot_id: string
  primary_cause_tag: JobReviewPrimaryCauseTag | null
  review_notes: string | null
  status: Exclude<JobReviewStatus, 'locked'>
  exclude_from_trends: boolean
  data_quality_status: JobReviewDataQualityStatus
  change_order_present: boolean
}

export type AcceptedEstimateSnapshotRepairResult = {
  estimate_id: string
  accepted_public_version_id: string
  estimate_snapshot_id: string | null
}
