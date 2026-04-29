import { supabaseAdmin } from '@/lib/server/org'
import { assertSchema, isMissingSchemaErrorMessage } from '@/lib/server/schema'
import {
  buildJobSelect,
  filterOptionalJobColumnPayload,
  getAvailableOptionalJobColumns,
  withOptionalJobColumns,
} from '@/lib/server/jobSchema'
import { deriveJobScheduleRange } from '@/lib/server/jobScheduleSync'
import type { JobStatus } from '@/lib/jobs/types'
import {
  errorResult,
  okResult,
  type ServiceError,
  type ServiceResult,
} from '@/lib/server/serviceResult'
import {
  buildJobDetailRecord,
  buildJobSummaryRecord,
  type CreateJobInput,
  type JobDetailRecord,
  type JobSummaryRecord,
  type UpdateJobInput,
} from './serviceCore.ts'
export {
  buildJobDetailRecord,
  buildJobSummaryRecord,
  normalizeCreateJobInput,
  normalizeUpdateJobInput,
} from './serviceCore.ts'

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

type JobScheduleRow = {
  job_id: string
  start_at: string | null
  end_at: string | null
}

type LinkedEstimateRow = {
  id: string
  status: string | null
  version_name: string | null
  version_state: string | null
  version_kind: string | null
  version_sort_order: number | null
  updated_at: string | null
  created_at: string | null
}

type JobScheduleRange = {
  scheduled_date: string | null
  scheduled_end_date: string | null
}

const listJobColumns = [
  'id',
  'customer_id',
  'title',
  'description',
  'status',
  'estimate_date',
  'estimate_sent_at',
  'scheduled_date',
  'scheduled_end_date',
  'completed_at',
  'closeout_notes',
  'created_at',
  'updated_at',
] as const

const detailJobColumns = [
  'id',
  'org_id',
  'customer_id',
  'title',
  'description',
  'status',
  'estimate_date',
  'estimate_sent_at',
  'scheduled_date',
  'scheduled_end_date',
  'completed_at',
  'closeout_notes',
  'created_at',
  'updated_at',
] as const

const mutableJobColumns = [
  'title',
  'description',
  'status',
  'estimate_date',
  'estimate_sent_at',
  'scheduled_date',
  'scheduled_end_date',
  'completed_at',
  'closeout_notes',
] as const

function asString(value: unknown) {
  return typeof value === 'string' ? value : null
}

function createSchemaError(message: string): ServiceError {
  return errorResult(
    'server_error',
    isMissingSchemaErrorMessage(message)
      ? 'Missing required jobs schema. Run the latest SQL migrations.'
      : message
  )
}

async function ensureJobsSchema(columns: readonly string[]) {
  const schema = await assertSchema([{ table: 'jobs', columns: [...columns, 'org_id'] }])
  if (!schema.ok) {
    return createSchemaError(schema.error)
  }
  return null
}

async function getOptionalJobColumns() {
  const optionalColumns = await getAvailableOptionalJobColumns()
  const linkedEstimateColumn = await assertSchema([
    { table: 'jobs', columns: ['linked_estimate_id'] },
  ])

  return linkedEstimateColumn.ok
    ? [...optionalColumns, 'linked_estimate_id']
    : optionalColumns
}

async function buildSelect(columns: readonly string[]) {
  const optionalColumns = await getOptionalJobColumns()
  return {
    optionalColumns,
    select: buildJobSelect([...columns], optionalColumns),
  }
}

async function loadCustomersById(orgId: string, customerIds: string[]) {
  const uniqueIds = Array.from(new Set(customerIds.filter(Boolean)))
  const customerById = new Map<string, CustomerRow>()

  if (uniqueIds.length === 0) {
    return okResult(customerById)
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('id, name, address, email, phone')
    .eq('org_id', orgId)
    .in('id', uniqueIds)

  if (error) {
    return errorResult('server_error', error.message)
  }

  for (const row of (data ?? []) as CustomerRow[]) {
    customerById.set(row.id, row)
  }

  return okResult(customerById)
}

async function loadScheduleRangeByJobId(orgId: string, jobIds: string[]) {
  const rangeByJobId = new Map<string, JobScheduleRange>()
  if (jobIds.length === 0) {
    return okResult(rangeByJobId)
  }

  const { data, error } = await supabaseAdmin
    .from('job_schedules')
    .select('job_id, start_at, end_at')
    .eq('org_id', orgId)
    .in('job_id', jobIds)

  if (error) {
    if (isMissingSchemaErrorMessage(error.message)) {
      return okResult(rangeByJobId)
    }
    return errorResult('server_error', error.message)
  }

  const rowsByJob = new Map<string, JobScheduleRow[]>()
  for (const row of (data ?? []) as JobScheduleRow[]) {
    const nextRows = rowsByJob.get(row.job_id) ?? []
    nextRows.push(row)
    rowsByJob.set(row.job_id, nextRows)
  }

  for (const [jobId, rows] of rowsByJob.entries()) {
    const range = deriveJobScheduleRange(rows)
    rangeByJobId.set(jobId, {
      scheduled_date: range.scheduled_date,
      scheduled_end_date: range.scheduled_end_date,
    })
  }

  return okResult(rangeByJobId)
}

async function loadLinkedEstimates(orgId: string, jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('estimates')
    .select(
      'id, status, version_name, version_state, version_kind, version_sort_order, updated_at, created_at'
    )
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .order('version_sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    return errorResult('server_error', error.message)
  }

  return okResult((data ?? []) as LinkedEstimateRow[])
}

export async function listJobs(orgId: string): Promise<ServiceResult<JobSummaryRecord[]>> {
  const { optionalColumns, select } = await buildSelect(listJobColumns)
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(select)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    return errorResult('server_error', 'Unable to load jobs.')
  }

  const rows = ((data ?? []) as unknown) as JobRow[]
  const jobIds = rows.map((row) => asString(row.id)).filter((value): value is string => Boolean(value))
  const customerIds = rows
    .map((row) => asString(row.customer_id))
    .filter((value): value is string => Boolean(value))

  const [customersResult, scheduleResult] = await Promise.all([
    loadCustomersById(orgId, customerIds),
    loadScheduleRangeByJobId(orgId, jobIds),
  ])

  if (!customersResult.ok) return customersResult
  if (!scheduleResult.ok) return scheduleResult

  return okResult(
    rows.map((row) =>
      buildJobSummaryRecord({
        row,
        optionalColumns,
        customer: asString(row.customer_id)
          ? customersResult.data.get(asString(row.customer_id) as string) ?? null
          : null,
        scheduleRange: asString(row.id) ? scheduleResult.data.get(asString(row.id) as string) ?? null : null,
        withOptionalJobColumns: (sourceRow, availableColumns) =>
          ((withOptionalJobColumns(
            sourceRow as Record<string, unknown>,
            availableColumns
          ) ?? sourceRow) as JobRow),
      })
    )
  )
}

export async function createJob(
  orgId: string,
  input: CreateJobInput
): Promise<ServiceResult<JobSummaryRecord>> {
  const schemaError = await ensureJobsSchema([
    ...mutableJobColumns,
    'customer_id',
    'created_at',
    'updated_at',
  ])
  if (schemaError) return schemaError

  const { optionalColumns, select } = await buildSelect(listJobColumns)
  const insertPayload: Record<string, unknown> = {
    org_id: orgId,
    customer_id: input.customer_id,
    title: input.title,
    description: input.description,
    status: input.status,
    estimate_date: input.estimate_date,
    estimate_sent_at: input.estimate_sent_at,
    scheduled_date: input.scheduled_date,
    scheduled_end_date: input.scheduled_end_date,
    completed_at: input.completed_at,
    closeout_notes: input.closeout_notes,
  }

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .insert(filterOptionalJobColumnPayload(insertPayload, optionalColumns))
    .select(select)
    .single()

  if (error) {
    return errorResult('server_error', 'Unable to create job.')
  }

  const customersResult = await loadCustomersById(orgId, [input.customer_id])
  if (!customersResult.ok) return customersResult

  return okResult(
    buildJobSummaryRecord({
      row: ((data ?? null) as unknown) as JobRow,
      optionalColumns,
      customer: customersResult.data.get(input.customer_id) ?? null,
      scheduleRange: null,
      withOptionalJobColumns: (sourceRow, availableColumns) =>
        ((withOptionalJobColumns(
          sourceRow as Record<string, unknown>,
          availableColumns
        ) ?? sourceRow) as JobRow),
    })
  )
}

export async function getJobDetail(
  orgId: string,
  jobId: string
): Promise<ServiceResult<JobDetailRecord>> {
  const { optionalColumns, select } = await buildSelect(detailJobColumns)
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .select(select)
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (error) {
    return errorResult('server_error', error.message)
  }
  if (!data) {
    return errorResult('not_found', 'Job not found')
  }

  const jobRow = withOptionalJobColumns(
    ((data ?? null) as unknown) as Record<string, unknown> | null,
    optionalColumns
  ) as JobRow

  if (!jobRow.scheduled_date || !jobRow.scheduled_end_date) {
    const scheduleResult = await loadScheduleRangeByJobId(orgId, [jobId])
    if (!scheduleResult.ok) return scheduleResult
    const range = scheduleResult.data.get(jobId)
    if (range) {
      jobRow.scheduled_date = jobRow.scheduled_date ?? range.scheduled_date
      jobRow.scheduled_end_date = jobRow.scheduled_end_date ?? range.scheduled_end_date
    }
  }

  const [customersResult, linkedEstimatesResult] = await Promise.all([
    loadCustomersById(orgId, asString(jobRow.customer_id) ? [asString(jobRow.customer_id) as string] : []),
    loadLinkedEstimates(orgId, jobId),
  ])

  if (!customersResult.ok) return customersResult
  if (!linkedEstimatesResult.ok) return linkedEstimatesResult

  const customerId = asString(jobRow.customer_id)
  return okResult(
    buildJobDetailRecord({
      row: jobRow,
      optionalColumns,
      customer: customerId ? customersResult.data.get(customerId) ?? null : null,
      linkedEstimates: linkedEstimatesResult.data,
      withOptionalJobColumns: (sourceRow, availableColumns) =>
        ((withOptionalJobColumns(
          sourceRow as Record<string, unknown>,
          availableColumns
        ) ?? sourceRow) as JobRow),
    })
  )
}

export async function updateJob(
  orgId: string,
  jobId: string,
  input: UpdateJobInput
): Promise<ServiceResult<Partial<JobDetailRecord>>> {
  const schemaError = await ensureJobsSchema(mutableJobColumns)
  if (schemaError) return schemaError

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('jobs')
    .select('id, status')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (existingError) {
    return errorResult('server_error', existingError.message)
  }
  if (!existing) {
    return errorResult('not_found', 'Job not found')
  }

  const { optionalColumns, select } = await buildSelect(listJobColumns)
  const nextPayload: UpdateJobInput = {
    ...input,
    status: input.status ?? ((asString(existing.status) as JobStatus | null) ?? 'estimate_scheduled'),
  }

  const { data, error } = await supabaseAdmin
    .from('jobs')
    .update(filterOptionalJobColumnPayload(nextPayload as Record<string, unknown>, optionalColumns))
    .eq('org_id', orgId)
    .eq('id', jobId)
    .select(select)
    .single()

  if (error) {
    return errorResult('server_error', error.message)
  }

  return okResult(
    withOptionalJobColumns(
      ((data ?? null) as unknown) as Record<string, unknown> | null,
      optionalColumns
    ) as Partial<JobDetailRecord>
  )
}

export async function deleteJob(
  orgId: string,
  jobId: string
): Promise<ServiceResult<{ ok: true }>> {
  const { data, error } = await supabaseAdmin
    .from('jobs')
    .delete()
    .eq('org_id', orgId)
    .eq('id', jobId)
    .select('id')
    .maybeSingle()

  if (error) {
    return errorResult('server_error', error.message)
  }
  if (!data) {
    return errorResult('not_found', 'Job not found')
  }

  return okResult({ ok: true })
}
