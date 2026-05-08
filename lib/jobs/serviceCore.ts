import {
  isJobStatus,
  resolveImpliedJobStatusFromPatch,
  type JobStatus,
} from './types.ts'
import {
  errorResult,
  okResult,
  type ServiceResult,
} from '../server/serviceResult.ts'
import type {
  JobAcceptedEstimateDetail,
  JobDetail,
  JobLinkedEstimateSummary,
  JobSummary,
} from '../../types/jobs/api.ts'
import type { JobActualsStatus } from '../../types/jobs/feedback.ts'
import type { AcceptedEstimateSource } from '../server/accepted-estimates/types.ts'

type JobRow = {
  id?: string | null
  org_id?: string | null
  customer_id?: string | null
  title?: string | null
  description?: string | null
  status?: string | null
  estimate_date?: string | null
  estimate_sent_at?: string | null
  scheduled_date?: string | null
  scheduled_end_date?: string | null
  completed_at?: string | null
  scheduled_email_sent_at?: string | null
  completed_email_sent_at?: string | null
  closeout_notes?: string | null
  linked_estimate_id?: string | null
  created_at?: string | null
  updated_at?: string | null
  [key: string]: unknown
}

type CustomerRow = {
  id: string
  name?: string | null
  address?: string | null
  email?: string | null
  phone?: string | null
}

type QuoteNavigationEstimateRow = JobLinkedEstimateSummary

type JobScheduleRange = {
  scheduled_date: string | null
  scheduled_end_date: string | null
}

export type JobAcceptedEstimateRecord = JobAcceptedEstimateDetail
type JobSummaryRecord = JobSummary
type JobDetailRecord = JobDetail
export type {
  JobDetailRecord,
  JobSummaryRecord,
}

export type CreateJobInput = {
  customer_id: string
  title: string
  description: string | null
  status: JobStatus
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  scheduled_end_date: string | null
  completed_at: string | null
  closeout_notes: string | null
}

export type UpdateJobInput = Partial<{
  title: string
  description: string | null
  status: JobStatus
  estimate_date: string | null
  estimate_sent_at: string | null
  scheduled_date: string | null
  scheduled_end_date: string | null
  completed_at: string | null
  closeout_notes: string | null
}>

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function normalizeNullableString(value: unknown) {
  if (value == null) return null
  return typeof value === 'string' ? value : String(value)
}

function normalizeJobStatus(value: string | null | undefined): JobStatus {
  return isJobStatus(value) ? value : 'estimate_scheduled'
}

export function buildJobSummaryRecord(params: {
  row: JobRow
  optionalColumns: string[]
  customer?: CustomerRow | null
  scheduleRange?: JobScheduleRange | null
  withOptionalJobColumns?: (
    row: JobRow,
    optionalColumns: string[]
  ) => JobRow
}): JobSummaryRecord {
  const safeRow = (params.withOptionalJobColumns?.(params.row, params.optionalColumns) ??
    params.row) as JobRow
  const scheduledDate = asString(safeRow.scheduled_date) ?? params.scheduleRange?.scheduled_date ?? null
  const scheduledEndDate =
    asString(safeRow.scheduled_end_date) ?? params.scheduleRange?.scheduled_end_date ?? null

  return {
    ...(safeRow as Record<string, unknown>),
    id: asString(safeRow.id) ?? '',
    customer_id: asString(safeRow.customer_id),
    customer_name: params.customer?.name ?? null,
    customer_address: params.customer?.address ?? null,
    title: asString(safeRow.title) ?? 'Untitled job',
    description: asString(safeRow.description),
    status: normalizeJobStatus(asString(safeRow.status)),
    estimate_date: asString(safeRow.estimate_date),
    estimate_sent_at: asString(safeRow.estimate_sent_at),
    scheduled_date: scheduledDate,
    scheduled_end_date: scheduledEndDate,
    scheduled_email_sent_at: asString(safeRow.scheduled_email_sent_at),
    completed_at: asString(safeRow.completed_at),
    completed_email_sent_at: asString(safeRow.completed_email_sent_at),
    closeout_notes: asString(safeRow.closeout_notes),
    created_at: asString(safeRow.created_at),
    linked_estimate_id: asString(safeRow.linked_estimate_id),
  }
}

export function buildJobDetailRecord(params: {
  row: JobRow
  optionalColumns: string[]
  customer?: CustomerRow | null
  quoteNavigationEstimates?: QuoteNavigationEstimateRow[]
  acceptedEstimate?: JobAcceptedEstimateRecord | null
  jobActualsStatus?: JobActualsStatus | null
  publicQuoteTimelineEvents?: JobDetail['public_quote_timeline_events']
  withOptionalJobColumns?: (
    row: JobRow,
    optionalColumns: string[]
  ) => JobRow
}): JobDetailRecord {
  const summary = buildJobSummaryRecord({
    row: params.row,
    optionalColumns: params.optionalColumns,
    customer: params.customer,
    withOptionalJobColumns: params.withOptionalJobColumns,
  })

  const quoteNavigationEstimateId =
    summary.linked_estimate_id ?? params.quoteNavigationEstimates?.[0]?.id ?? null

  return {
    ...summary,
    customer_email: params.customer?.email ?? null,
    customer_phone: params.customer?.phone ?? null,
    scheduled_end_date: summary.scheduled_end_date ?? null,
    linked_estimates: params.quoteNavigationEstimates ?? [],
    linked_estimate_id: summary.linked_estimate_id ?? null,
    // Quote navigation is intentionally separate from operational accepted
    // estimate ownership. linked_estimate_id remains the canonical accepted
    // link; the linked_estimates fallback only supports opening an existing
    // quote route.
    estimate_navigation_id: quoteNavigationEstimateId,
    accepted_estimate: params.acceptedEstimate ?? null,
    job_actuals_status: params.jobActualsStatus ?? null,
    public_quote_timeline_events: params.publicQuoteTimelineEvents ?? [],
  }
}

export function buildJobAcceptedEstimateRecord(
  source: AcceptedEstimateSource
): JobAcceptedEstimateRecord {
  return {
    estimate_id: source.estimate_id,
    accepted_public_version_id: source.accepted_public_version_id,
    public_version_number: source.public_version_number,
    public_token: source.public_token,
    accepted_at: source.accepted_at,
    accepted_by_legal_name: source.accepted_by_legal_name,
    signature_type: source.signature_type,
    user_agent: source.user_agent,
    ip: source.ip,
    version_name: source.version_name,
    estimate_snapshot_id: source.estimate_snapshot_id,
    estimated_labor_hours: source.estimated_labor_hours,
    estimated_paint_gallons: source.estimated_paint_gallons,
    estimated_supplies_cost: source.estimated_supplies_cost,
    estimated_other_cost: source.estimated_other_cost,
    final_total: source.final_total,
  }
}

export function buildJobAcceptedEstimateRecordResult(
  source: ServiceResult<AcceptedEstimateSource>
): ServiceResult<JobAcceptedEstimateRecord> {
  if (!source.ok) return source
  return okResult(buildJobAcceptedEstimateRecord(source.data))
}

export function normalizeCreateJobInput(
  body: Record<string, unknown>
): ServiceResult<CreateJobInput> {
  const customerId = asString(body.customer_id)?.trim() ?? ''
  const title = asString(body.title)?.trim() ?? ''

  if (!customerId) {
    return errorResult('invalid_input', 'Missing customer_id')
  }
  if (!title) {
    return errorResult('invalid_input', 'Missing title')
  }

  const rawStatus = asString(body.status)
  if (rawStatus && !isJobStatus(rawStatus)) {
    return errorResult('invalid_input', 'Invalid job status')
  }

  return okResult({
    customer_id: customerId,
    title,
    description: normalizeNullableString(body.description),
    status: normalizeJobStatus(rawStatus),
    estimate_date: asString(body.estimate_date),
    estimate_sent_at: asString(body.estimate_sent_at),
    scheduled_date: asString(body.scheduled_date),
    scheduled_end_date: asString(body.scheduled_end_date),
    completed_at: asString(body.completed_at),
    closeout_notes: normalizeNullableString(body.closeout_notes),
  })
}

export function normalizeUpdateJobInput(
  body: Record<string, unknown>
): ServiceResult<UpdateJobInput> {
  const next: UpdateJobInput = {}

  if ('title' in body) {
    const title = asString(body.title)?.trim() ?? ''
    if (!title) {
      return errorResult('invalid_input', 'Title cannot be empty')
    }
    next.title = title
  }

  if ('description' in body) {
    next.description = normalizeNullableString(body.description)
  }

  if ('status' in body) {
    const status = asString(body.status)
    if (!status || !isJobStatus(status)) {
      return errorResult('invalid_input', 'Invalid job status')
    }
    next.status = status
  }

  for (const field of [
    'estimate_date',
    'estimate_sent_at',
    'scheduled_date',
    'scheduled_end_date',
    'completed_at',
  ] as const) {
    if (field in body) {
      const value = body[field]
      if (value != null && typeof value !== 'string') {
        return errorResult('invalid_input', `Invalid ${field}`)
      }
      next[field] = value == null ? null : value
    }
  }

  if ('closeout_notes' in body) {
    next.closeout_notes = normalizeNullableString(body.closeout_notes)
  }

  if (Object.keys(next).length === 0) {
    return errorResult('invalid_input', 'No supported job fields provided')
  }

  if (!next.status) {
    next.status =
      resolveImpliedJobStatusFromPatch(
        next as Partial<
          Record<'completed_at' | 'scheduled_date' | 'estimate_sent_at' | 'estimate_date', unknown>
        >
      ) ?? undefined
  }

  return okResult(next)
}
