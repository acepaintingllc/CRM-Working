import {
  isJobReviewPrimaryCauseTag,
  isJobReviewDataQualityStatus,
  jobReviewCauseTagOptions,
  jobReviewDataQualityOptions,
  type JobActualsDraftPayload,
  type JobActualsRecord,
  type JobReviewDataQualityStatus,
  type JobReviewPayload,
  type JobReviewReadModel,
  type JobReviewStatus,
} from '@/types/jobs/feedback'

export type JobActualsFormState = {
  actual_labor_hours: string
  actual_paint_gallons: string
  actual_supplies_cost: string
  actual_other_cost: string
  notes: string
}

export type JobActualsNumericField = keyof Omit<JobActualsFormState, 'notes'>
export type JobActualsFieldValidation = Partial<Record<JobActualsNumericField, string>>
export type JobActualsNumericFieldDefinition = {
  id: JobActualsNumericField
  label: string
  estimateKey:
    | 'estimated_labor_hours'
    | 'estimated_paint_gallons'
    | 'estimated_supplies_cost'
    | 'estimated_other_cost'
  unit: 'hours' | 'gallons' | 'currency'
  step: string
  blankHelp: string
}

type ActualsParseResult =
  | { ok: true; value: number; error: null }
  | { ok: false; value: null; error: string }

export const jobActualsNumericFields = [
  {
    id: 'actual_labor_hours',
    label: 'Labor hours',
    estimateKey: 'estimated_labor_hours',
    unit: 'hours',
    step: '0.25',
    blankHelp: 'Blank saves as 0.',
  },
  {
    id: 'actual_paint_gallons',
    label: 'Paint gallons',
    estimateKey: 'estimated_paint_gallons',
    unit: 'gallons',
    step: '0.01',
    blankHelp: 'Blank saves as 0.',
  },
  {
    id: 'actual_supplies_cost',
    label: 'Supplies cost',
    estimateKey: 'estimated_supplies_cost',
    unit: 'currency',
    step: '0.01',
    blankHelp: 'Blank saves as $0.',
  },
  {
    id: 'actual_other_cost',
    label: 'Other cost',
    estimateKey: 'estimated_other_cost',
    unit: 'currency',
    step: '0.01',
    blankHelp: 'Blank saves as $0.',
  },
] as const satisfies readonly JobActualsNumericFieldDefinition[]

export const jobReviewClassificationOptions = {
  causeTags: jobReviewCauseTagOptions,
  dataQuality: jobReviewDataQualityOptions,
} as const

function jobActualsFieldLabel(field: JobActualsNumericField) {
  return jobActualsNumericFields.find((definition) => definition.id === field)?.label ?? field
}

function asTrimmedOptionalText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function asPrimaryCauseTag(value: string) {
  const trimmed = asTrimmedOptionalText(value)
  if (trimmed === null) return null
  if (!isJobReviewPrimaryCauseTag(trimmed)) {
    throw new Error('primary_cause_tag is not allowed.')
  }
  return trimmed
}

function asDataQualityStatus(value: string) {
  if (!isJobReviewDataQualityStatus(value)) {
    throw new Error('data_quality_status is not allowed.')
  }
  return value
}

export function parseJobActualsNumberDraft(value: string, label: string): ActualsParseResult {
  const trimmed = value.trim()
  const numeric = trimmed === '' ? 0 : Number(trimmed)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return {
      ok: false,
      value: null,
      error: `${label} must be a non-negative number.`,
    }
  }

  return {
    ok: true,
    value: numeric,
    error: null,
  }
}

export function validateJobActualsForm(form: JobActualsFormState): JobActualsFieldValidation {
  const validation: JobActualsFieldValidation = {}

  for (const field of jobActualsNumericFields) {
    const result = parseJobActualsNumberDraft(form[field.id], field.label)
    if (!result.ok) validation[field.id] = result.error
  }

  return validation
}

export function buildJobActualsFormState(actuals: JobActualsRecord | null): JobActualsFormState {
  return {
    actual_labor_hours: actuals ? String(actuals.actual_labor_hours) : '',
    actual_paint_gallons: actuals ? String(actuals.actual_paint_gallons) : '',
    actual_supplies_cost: actuals ? String(actuals.actual_supplies_cost) : '',
    actual_other_cost: actuals ? String(actuals.actual_other_cost) : '',
    notes: actuals?.notes ?? '',
  }
}

export function areJobActualsFormStatesEqual(
  left: JobActualsFormState,
  right: JobActualsFormState
) {
  return (
    left.actual_labor_hours === right.actual_labor_hours &&
    left.actual_paint_gallons === right.actual_paint_gallons &&
    left.actual_supplies_cost === right.actual_supplies_cost &&
    left.actual_other_cost === right.actual_other_cost &&
    left.notes === right.notes
  )
}

export function buildJobActualsDraftPayload(
  form: JobActualsFormState,
  estimateSnapshotId: string
): JobActualsDraftPayload {
  const parsed = {} as Record<JobActualsNumericField, number>
  for (const field of jobActualsNumericFields) {
    const result = parseJobActualsNumberDraft(form[field.id], jobActualsFieldLabel(field.id))
    if (!result.ok) throw new Error(result.error)
    parsed[field.id] = result.value
  }

  return {
    estimate_snapshot_id: estimateSnapshotId,
    actual_labor_hours: parsed.actual_labor_hours,
    actual_paint_gallons: parsed.actual_paint_gallons,
    actual_supplies_cost: parsed.actual_supplies_cost,
    actual_other_cost: parsed.actual_other_cost,
    notes: asTrimmedOptionalText(form.notes),
  }
}

export type JobReviewFormState = {
  primary_cause_tag: string
  review_notes: string
  data_quality_status: JobReviewDataQualityStatus
  exclude_from_trends: boolean
  change_order_present: boolean
}

export function areJobReviewFormStatesEqual(
  left: JobReviewFormState,
  right: JobReviewFormState
) {
  return (
    left.primary_cause_tag === right.primary_cause_tag &&
    left.review_notes === right.review_notes &&
    left.data_quality_status === right.data_quality_status &&
    left.exclude_from_trends === right.exclude_from_trends &&
    left.change_order_present === right.change_order_present
  )
}

export function buildJobReviewFormState(model: JobReviewReadModel | null): JobReviewFormState {
  const review = model?.review ?? null
  return {
    primary_cause_tag: review?.primary_cause_tag ?? '',
    review_notes: review?.review_notes ?? '',
    data_quality_status: review?.data_quality_status ?? 'valid',
    exclude_from_trends: review?.exclude_from_trends ?? false,
    change_order_present: review?.change_order_present ?? false,
  }
}

export function buildJobReviewPayload(
  form: JobReviewFormState,
  estimateSnapshotId: string,
  status: Exclude<JobReviewStatus, 'locked'>
): JobReviewPayload {
  return {
    estimate_snapshot_id: estimateSnapshotId,
    primary_cause_tag: asPrimaryCauseTag(form.primary_cause_tag),
    review_notes: asTrimmedOptionalText(form.review_notes),
    status,
    exclude_from_trends: form.exclude_from_trends,
    data_quality_status: asDataQualityStatus(form.data_quality_status),
    change_order_present: form.change_order_present,
  }
}
