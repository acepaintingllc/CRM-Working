import { supabaseAdmin } from '../org.ts'
import { isUuid } from '../routeUtils.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type { JobActualsRecord } from '../../../types/jobs/feedback.ts'

export type JobActualsRow = JobActualsRecord

export type JobActualsDraftInput = {
  estimate_snapshot_id: string
  actual_labor_hours: number
  actual_paint_gallons: number
  actual_supplies_cost: number
  actual_other_cost: number
  notes: string | null
}

type ActualsDbError = { code?: string | null; message?: string | null }
type QueryResponse<T> = { data: T | null; error: ActualsDbError | null }
type QueryBuilder = {
  select(columns: string): QueryBuilder
  eq(column: string, value: unknown): QueryBuilder
  insert(payload: Record<string, unknown>): QueryBuilder
  update(payload: Record<string, unknown>): QueryBuilder
  maybeSingle<T = unknown>(): Promise<QueryResponse<T>>
  single<T = unknown>(): Promise<QueryResponse<T>>
}
type DbClient = { from(table: string): QueryBuilder }
type ActualsDeps = { db?: DbClient; now?: () => Date }

const maxNotesLength = 4_000
const actualsSelect = [
  'id',
  'org_id',
  'job_id',
  'estimate_snapshot_id',
  'actual_labor_hours',
  'actual_paint_gallons',
  'actual_supplies_cost',
  'actual_other_cost',
  'notes',
  'status',
  'submitted_at',
  'locked_at',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
].join(', ')

function getDb(deps?: ActualsDeps): DbClient {
  return deps?.db ?? (supabaseAdmin as unknown as DbClient)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asUuid(value: unknown, label: string): ServiceResult<string> {
  if (!isUuid(value)) {
    return errorResult('invalid_input', `Invalid ${label}.`)
  }
  return okResult(value)
}

function asNonNegativeNumber(value: unknown, label: string): ServiceResult<number> {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) {
    return errorResult('invalid_input', `${label} must be a non-negative number.`)
  }
  return okResult(numeric)
}

function normalizeNotes(value: unknown): ServiceResult<string | null> {
  if (value == null) return okResult(null)
  if (typeof value !== 'string') return errorResult('invalid_input', 'notes must be text.')
  const trimmed = value.trim()
  if (!trimmed) return okResult(null)
  if (trimmed.length > maxNotesLength) {
    return errorResult('invalid_input', `notes must be ${maxNotesLength} characters or fewer.`)
  }
  return okResult(trimmed)
}

function readBodyField(body: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return body[snakeKey] ?? body[camelKey]
}

export function normalizeJobActualsDraftInput(body: unknown): ServiceResult<JobActualsDraftInput> {
  if (!isRecord(body)) return errorResult('invalid_input', 'Actuals payload must be an object.')

  const snapshotId = asUuid(
    readBodyField(body, 'estimate_snapshot_id', 'estimateSnapshotId'),
    'estimate snapshot id'
  )
  if (!snapshotId.ok) return snapshotId

  const labor = asNonNegativeNumber(
    readBodyField(body, 'actual_labor_hours', 'actualLaborHours'),
    'actual_labor_hours'
  )
  if (!labor.ok) return labor

  const paint = asNonNegativeNumber(
    readBodyField(body, 'actual_paint_gallons', 'actualPaintGallons'),
    'actual_paint_gallons'
  )
  if (!paint.ok) return paint

  const supplies = asNonNegativeNumber(
    readBodyField(body, 'actual_supplies_cost', 'actualSuppliesCost'),
    'actual_supplies_cost'
  )
  if (!supplies.ok) return supplies

  const other = asNonNegativeNumber(
    readBodyField(body, 'actual_other_cost', 'actualOtherCost'),
    'actual_other_cost'
  )
  if (!other.ok) return other

  const notes = normalizeNotes(body.notes)
  if (!notes.ok) return notes

  return okResult({
    estimate_snapshot_id: snapshotId.data,
    actual_labor_hours: labor.data,
    actual_paint_gallons: paint.data,
    actual_supplies_cost: supplies.data,
    actual_other_cost: other.data,
    notes: notes.data,
  })
}

export function normalizeActualsSnapshotId(value: unknown): ServiceResult<string> {
  return asUuid(value, 'estimate snapshot id')
}

async function ensureSnapshotForJob(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId: string
): Promise<ServiceResult<{ id: string }>> {
  const { data, error } = await db
    .from('estimate_snapshot')
    .select('id')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('id', estimateSnapshotId)
    .maybeSingle<{ id: string }>()

  if (error) {
    return errorResult('server_error', error.message ?? 'Unable to validate estimate snapshot.')
  }
  if (!data) {
    return errorResult('not_found', 'Estimate snapshot not found for this job.')
  }
  return okResult(data)
}

async function loadActualsRow(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId: string
) {
  return db
    .from('job_actuals')
    .select(actualsSelect)
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('estimate_snapshot_id', estimateSnapshotId)
    .maybeSingle<JobActualsRow>()
}

function isUniqueConflict(error: ActualsDbError | null) {
  const message = (error?.message ?? '').toLowerCase()
  return error?.code === '23505' || message.includes('duplicate') || message.includes('unique')
}

export async function loadJobActuals(
  orgId: string,
  jobId: string,
  estimateSnapshotId: string,
  deps?: ActualsDeps
): Promise<ServiceResult<JobActualsRow | null>> {
  const db = getDb(deps)
  const snapshot = await ensureSnapshotForJob(db, orgId, jobId, estimateSnapshotId)
  if (!snapshot.ok) return snapshot

  const { data, error } = await loadActualsRow(db, orgId, jobId, estimateSnapshotId)
  if (error) return errorResult('server_error', error.message ?? 'Unable to load job actuals.')
  return okResult(data ?? null)
}

export async function saveDraftJobActuals(
  params: {
    orgId: string
    jobId: string
    userId: string
    input: JobActualsDraftInput
  },
  deps?: ActualsDeps
): Promise<ServiceResult<JobActualsRow>> {
  const db = getDb(deps)
  const snapshot = await ensureSnapshotForJob(
    db,
    params.orgId,
    params.jobId,
    params.input.estimate_snapshot_id
  )
  if (!snapshot.ok) return snapshot

  const existing = await loadActualsRow(
    db,
    params.orgId,
    params.jobId,
    params.input.estimate_snapshot_id
  )
  if (existing.error) {
    return errorResult('server_error', existing.error.message ?? 'Unable to inspect job actuals.')
  }

  const payload = {
    actual_labor_hours: params.input.actual_labor_hours,
    actual_paint_gallons: params.input.actual_paint_gallons,
    actual_supplies_cost: params.input.actual_supplies_cost,
    actual_other_cost: params.input.actual_other_cost,
    notes: params.input.notes,
    updated_by: params.userId,
  }

  if (existing.data) {
    if (existing.data.status !== 'draft') {
      return errorResult(
        'conflict',
        'Submitted or locked job actuals cannot be overwritten through draft save.'
      )
    }
    const { data, error } = await db
      .from('job_actuals')
      .update(payload)
      .eq('org_id', params.orgId)
      .eq('job_id', params.jobId)
      .eq('estimate_snapshot_id', params.input.estimate_snapshot_id)
      .eq('status', 'draft')
      .select(actualsSelect)
      .single<JobActualsRow>()
    if (error || !data) {
      return errorResult('server_error', error?.message ?? 'Unable to save draft job actuals.')
    }
    return okResult(data)
  }

  const { data, error } = await db
    .from('job_actuals')
    .insert({
      org_id: params.orgId,
      job_id: params.jobId,
      estimate_snapshot_id: params.input.estimate_snapshot_id,
      ...payload,
      status: 'draft',
      created_by: params.userId,
    })
    .select(actualsSelect)
    .single<JobActualsRow>()

  if (error || !data) {
    if (isUniqueConflict(error)) {
      return errorResult('conflict', 'Job actuals already exist for this estimate snapshot.')
    }
    return errorResult('server_error', error?.message ?? 'Unable to create draft job actuals.')
  }
  return okResult(data)
}

export async function submitJobActuals(
  params: { orgId: string; jobId: string; userId: string; estimateSnapshotId: string },
  deps?: ActualsDeps
): Promise<ServiceResult<JobActualsRow>> {
  const db = getDb(deps)
  const snapshot = await ensureSnapshotForJob(db, params.orgId, params.jobId, params.estimateSnapshotId)
  if (!snapshot.ok) return snapshot

  const existing = await loadActualsRow(db, params.orgId, params.jobId, params.estimateSnapshotId)
  if (existing.error) {
    return errorResult('server_error', existing.error.message ?? 'Unable to inspect job actuals.')
  }
  if (!existing.data) return errorResult('not_found', 'Draft job actuals not found.')
  if (existing.data.status !== 'draft') {
    return errorResult('conflict', 'Only draft job actuals can be submitted.')
  }

  const submittedAt = (deps?.now?.() ?? new Date()).toISOString()
  const { data, error } = await db
    .from('job_actuals')
    .update({
      status: 'submitted',
      submitted_at: submittedAt,
      updated_by: params.userId,
    })
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('estimate_snapshot_id', params.estimateSnapshotId)
    .eq('status', 'draft')
    .select(actualsSelect)
    .single<JobActualsRow>()

  if (error || !data) {
    return errorResult('server_error', error?.message ?? 'Unable to submit job actuals.')
  }
  return okResult(data)
}

export async function lockJobActuals(
  params: { orgId: string; jobId: string; userId: string; estimateSnapshotId: string },
  deps?: ActualsDeps
): Promise<ServiceResult<JobActualsRow>> {
  const db = getDb(deps)
  const snapshot = await ensureSnapshotForJob(db, params.orgId, params.jobId, params.estimateSnapshotId)
  if (!snapshot.ok) return snapshot

  const existing = await loadActualsRow(db, params.orgId, params.jobId, params.estimateSnapshotId)
  if (existing.error) {
    return errorResult('server_error', existing.error.message ?? 'Unable to inspect job actuals.')
  }
  if (!existing.data) return errorResult('not_found', 'Submitted job actuals not found.')
  if (existing.data.status !== 'submitted') {
    return errorResult('conflict', 'Only submitted job actuals can be locked.')
  }

  const lockedAt = (deps?.now?.() ?? new Date()).toISOString()
  const { data, error } = await db
    .from('job_actuals')
    .update({
      status: 'locked',
      locked_at: lockedAt,
      updated_by: params.userId,
    })
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('estimate_snapshot_id', params.estimateSnapshotId)
    .eq('status', 'submitted')
    .select(actualsSelect)
    .single<JobActualsRow>()

  if (error || !data) {
    return errorResult('server_error', error?.message ?? 'Unable to lock job actuals.')
  }
  return okResult(data)
}
