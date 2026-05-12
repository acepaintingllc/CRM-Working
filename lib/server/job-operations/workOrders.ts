import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type { AcceptedEstimateOperationalSource } from '@/types/job-operations/acceptedEstimateSource'
import type {
  JobColorSelectionsReadModel,
  JobColorSelectionSetRecord,
} from '@/types/job-operations/colorSelections'
import type {
  JobWorkOrderChangeOrderDelta,
  JobWorkOrderDocument,
  JobWorkOrderGenerateInput,
  JobWorkOrderGenerationWarning,
  JobWorkOrderReadModel,
  JobWorkOrderRow,
  JobWorkOrderSourceSummary,
  JobWorkOrderStatus,
} from '@/types/job-operations/workOrders'

type DbError = { code?: string | null; message?: string | null }
type QueryResponse<T> = { data: T | null; error: DbError | null }
type QueryListResponse<T> = { data: T[] | null; error: DbError | null }
type QueryBuilder = {
  select(columns: string): QueryBuilder
  eq(column: string, value: unknown): QueryBuilder
  in(column: string, values: unknown[]): QueryBuilder
  order(column: string, options?: { ascending?: boolean }): QueryBuilder
  limit(count: number): QueryBuilder
  insert(payload: Record<string, unknown>): QueryBuilder
  update(payload: Record<string, unknown>): QueryBuilder
  maybeSingle<T = unknown>(): Promise<QueryResponse<T>>
  single<T = unknown>(): Promise<QueryResponse<T>>
  then<TResult1 = QueryListResponse<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryListResponse<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2>
}
type DbClient = { from(table: string): QueryBuilder }

type WorkOrderDeps = {
  db?: DbClient
  now?: () => Date
  loadAcceptedEstimateOperationalSource?: LoadAcceptedEstimateOperationalSource
  loadJobColorSelections?: LoadJobColorSelections
}

type LoadAcceptedEstimateOperationalSource =
  typeof import('./acceptedEstimateSource.ts').loadAcceptedEstimateOperationalSource
type LoadJobColorSelections =
  typeof import('./colorSelections.ts').loadJobColorSelections

type ChangeOrderRow = {
  id: string
  change_order_number: string | null
  title: string | null
  description: string | null
  delta_total: number | string | null
  accepted_at: string | null
}

const workOrderSelect = [
  'id',
  'org_id',
  'job_id',
  'estimate_id',
  'estimate_snapshot_id',
  'color_selection_set_id',
  'revision_number',
  'status',
  'title',
  'work_order_number',
  'accepted_estimate_display_name',
  'customer_display_name',
  'job_display_name',
  'accepted_total',
  'change_order_total',
  'work_order_total',
  'document_json',
  'generated_snapshot_json',
  'source_summary_json',
  'generated_at',
  'locked_at',
  'issued_at',
  'voided_at',
  'created_at',
  'updated_at',
  'created_by',
  'updated_by',
].join(', ')

async function getDb(deps?: WorkOrderDeps): Promise<DbClient> {
  if (deps?.db) return deps.db
  return (await import('../org.ts')).supabaseAdmin as unknown as DbClient
}

async function getAcceptedEstimateOperationalSourceLoader(deps?: WorkOrderDeps) {
  if (deps?.loadAcceptedEstimateOperationalSource) {
    return deps.loadAcceptedEstimateOperationalSource
  }
  return (await import('./acceptedEstimateSource.ts')).loadAcceptedEstimateOperationalSource
}

async function getColorSelectionsLoader(deps?: WorkOrderDeps) {
  if (deps?.loadJobColorSelections) return deps.loadJobColorSelections
  return (await import('./colorSelections.ts')).loadJobColorSelections
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readBodyField(body: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return body[snakeKey] ?? body[camelKey]
}

function normalizeOptionalText(value: unknown, label: string, maxLength = 8_000): ServiceResult<string | null> {
  if (value == null) return okResult(null)
  if (typeof value !== 'string') return errorResult('invalid_input', `${label} must be text.`)
  const trimmed = value.trim()
  if (!trimmed) return okResult(null)
  if (trimmed.length > maxLength) {
    return errorResult('invalid_input', `${label} must be ${maxLength} characters or fewer.`)
  }
  return okResult(trimmed)
}

function asMoney(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

export function normalizeWorkOrderGenerateInput(body: unknown): ServiceResult<JobWorkOrderGenerateInput> {
  const record = isRecord(body) ? body : {}
  const crewNotes = normalizeOptionalText(readBodyField(record, 'crew_notes', 'crewNotes'), 'crew_notes')
  if (!crewNotes.ok) return crewNotes
  const accessPrepNotes = normalizeOptionalText(
    readBodyField(record, 'access_prep_notes', 'accessPrepNotes'),
    'access_prep_notes'
  )
  if (!accessPrepNotes.ok) return accessPrepNotes
  const specialNotes = normalizeOptionalText(
    readBodyField(record, 'special_notes', 'specialNotes'),
    'special_notes'
  )
  if (!specialNotes.ok) return specialNotes

  return okResult({
    force_with_warnings: Boolean(readBodyField(record, 'force_with_warnings', 'forceWithWarnings')),
    crew_notes: crewNotes.data,
    access_prep_notes: accessPrepNotes.data,
    special_notes: specialNotes.data,
  })
}

function customerName(source: AcceptedEstimateOperationalSource) {
  return source.customer.name ?? source.customer.email ?? source.customer.phone ?? null
}

function buildWarnings(colorModel: JobColorSelectionsReadModel): JobWorkOrderGenerationWarning[] {
  const warnings: JobWorkOrderGenerationWarning[] = []
  if (!colorModel.selection_set) {
    warnings.push({
      code: 'missing_color_selection_set',
      message: 'No color selection set exists for this accepted estimate.',
    })
  } else if (colorModel.selection_set.status !== 'confirmed') {
    warnings.push({
      code: 'color_selection_not_confirmed',
      message: 'Color selections have not been confirmed for production.',
    })
  }
  if (!colorModel.completeness.complete) {
    warnings.push({
      code: 'incomplete_color_selection',
      message: 'Required color selections are incomplete.',
    })
  }
  return warnings
}

export function validateWorkOrderGenerationReadiness(params: {
  colorModel: JobColorSelectionsReadModel
  forceWithWarnings: boolean
}): ServiceResult<JobWorkOrderGenerationWarning[]> {
  const warnings = buildWarnings(params.colorModel)
  if (warnings.length > 0 && !params.forceWithWarnings) {
    return errorResult(
      'invalid_input',
      'Work order generation requires confirmed, complete color selections. Regenerate with force_with_warnings to create a draft with warnings.'
    )
  }
  return okResult(warnings)
}

function normalizeChangeOrder(row: ChangeOrderRow): JobWorkOrderChangeOrderDelta {
  return {
    id: row.id,
    change_order_number: row.change_order_number,
    title: row.title,
    description: row.description,
    delta_total: asMoney(row.delta_total),
    accepted_at: row.accepted_at,
  }
}

async function loadAcceptedChangeOrderDeltas(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId: string
): Promise<ServiceResult<JobWorkOrderChangeOrderDelta[]>> {
  const result = (await db
    .from('job_change_orders')
    .select('id, change_order_number, title, description, delta_total, accepted_at')
    .eq('org_id', orgId)
    .eq('job_id', jobId)
    .eq('estimate_snapshot_id', estimateSnapshotId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: true })) as QueryListResponse<ChangeOrderRow>

  if (result.error) {
    return errorResult('server_error', result.error.message ?? 'Unable to load accepted change orders.')
  }
  return okResult((result.data ?? []).map(normalizeChangeOrder))
}

function buildSourceSummary(params: {
  source: AcceptedEstimateOperationalSource
  colorSelectionSet: JobColorSelectionSetRecord | null
  changeOrders: JobWorkOrderChangeOrderDelta[]
  warnings: JobWorkOrderGenerationWarning[]
  generatedAt: string
}): JobWorkOrderSourceSummary {
  return {
    source_kind: 'accepted_estimate_work_order',
    source_version: 1,
    org_id: params.source.source.org_id,
    job_id: params.source.source.job_id,
    estimate_id: params.source.source.estimate_id,
    estimate_snapshot_id: params.source.source.estimate_snapshot_id ?? '',
    accepted_public_version_id: params.source.source.accepted_public_version_id,
    color_selection_set_id: params.colorSelectionSet?.id ?? null,
    color_selection_status: params.colorSelectionSet?.status ?? null,
    color_selection_revision: params.colorSelectionSet?.revision_number ?? null,
    accepted_change_order_ids: params.changeOrders.map((row) => row.id),
    accepted_change_order_total: params.changeOrders.reduce((sum, row) => sum + row.delta_total, 0),
    warning_codes: params.warnings.map((warning) => warning.code),
    generated_at: params.generatedAt,
  }
}

export function buildWorkOrderDocument(params: {
  source: AcceptedEstimateOperationalSource
  colorModel: JobColorSelectionsReadModel
  changeOrders: JobWorkOrderChangeOrderDelta[]
  input: JobWorkOrderGenerateInput
  revisionNumber: number
  status: JobWorkOrderStatus
  generatedAt: string
  warnings: JobWorkOrderGenerationWarning[]
}): JobWorkOrderDocument {
  const sourceSummary = buildSourceSummary({
    source: params.source,
    colorSelectionSet: params.colorModel.selection_set,
    changeOrders: params.changeOrders,
    warnings: params.warnings,
    generatedAt: params.generatedAt,
  })
  const changeOrderTotal = sourceSummary.accepted_change_order_total

  return {
    kind: 'job_work_order',
    version: 1,
    generated_at: params.generatedAt,
    title: 'Work order',
    revision_number: params.revisionNumber,
    status: params.status,
    source: sourceSummary,
    warnings: jsonClone(params.warnings),
    customer: jsonClone(params.source.customer),
    job: jsonClone(params.source.job),
    estimate: jsonClone(params.source.estimate),
    acceptance: jsonClone(params.source.acceptance),
    totals: {
      accepted_total: params.source.totals.accepted_total,
      accepted_change_order_total: changeOrderTotal,
      work_order_total: params.source.totals.accepted_total + changeOrderTotal,
      estimated_labor_hours: params.source.totals.estimated_labor_hours,
      estimated_paint_gallons: params.source.totals.estimated_paint_gallons,
      estimated_supplies_cost: params.source.totals.estimated_supplies_cost,
      estimated_access_cost: params.source.totals.estimated_access_cost,
      estimated_other_cost: params.source.totals.estimated_other_cost,
    },
    rooms: jsonClone(params.source.rooms),
    scopes: jsonClone(params.source.scopes),
    products: jsonClone(params.source.products),
    materials: jsonClone(params.source.materials),
    confirmed_colors: jsonClone(params.colorModel.selections),
    color_completeness: jsonClone(params.colorModel.completeness),
    notes: {
      special_notes: params.input.special_notes,
      crew_notes: params.input.crew_notes,
      access_prep_notes: params.input.access_prep_notes,
      accepted_estimate_notes: jsonClone(params.source.notes),
    },
    change_order_deltas: jsonClone(params.changeOrders),
  }
}

async function loadLatestWorkOrder(
  db: DbClient,
  orgId: string,
  jobId: string,
  estimateSnapshotId?: string | null
) {
  let query = db
    .from('job_work_orders')
    .select(workOrderSelect)
    .eq('org_id', orgId)
    .eq('job_id', jobId)
  if (estimateSnapshotId) query = query.eq('estimate_snapshot_id', estimateSnapshotId)
  return query
    .order('revision_number', { ascending: false })
    .limit(1)
    .maybeSingle<JobWorkOrderRow>()
}

export async function loadJobWorkOrder(
  orgId: string,
  jobId: string,
  deps?: WorkOrderDeps
): Promise<ServiceResult<JobWorkOrderReadModel>> {
  const loadAcceptedSource = await getAcceptedEstimateOperationalSourceLoader(deps)
  const source = await loadAcceptedSource(
    { orgId, jobId },
    deps as Parameters<LoadAcceptedEstimateOperationalSource>[1]
  )
  if (!source.ok) return source

  const db = await getDb(deps)
  const latest = await loadLatestWorkOrder(
    db,
    orgId,
    jobId,
    source.data.source.estimate_snapshot_id
  )
  if (latest.error) {
    return errorResult('server_error', latest.error.message ?? 'Unable to load work order.')
  }
  return okResult({ current: latest.data ?? null })
}

function canReplaceWorkOrder(row: JobWorkOrderRow | null) {
  return row?.status === 'draft' || row?.status === 'generated'
}

function nextRevision(row: JobWorkOrderRow | null) {
  return row ? row.revision_number + 1 : 1
}

function isUniqueConflict(error: DbError | null) {
  const message = (error?.message ?? '').toLowerCase()
  return error?.code === '23505' || message.includes('duplicate') || message.includes('unique')
}

export async function generateJobWorkOrder(
  params: {
    orgId: string
    jobId: string
    userId: string
    input: JobWorkOrderGenerateInput
  },
  deps?: WorkOrderDeps
): Promise<ServiceResult<JobWorkOrderRow>> {
  const loadAcceptedSource = await getAcceptedEstimateOperationalSourceLoader(deps)
  const source = await loadAcceptedSource(
    { orgId: params.orgId, jobId: params.jobId },
    deps as Parameters<LoadAcceptedEstimateOperationalSource>[1]
  )
  if (!source.ok) return source
  if (!source.data.source.estimate_snapshot_id) {
    return errorResult('not_found', 'Accepted estimate snapshot is missing.')
  }

  const loadColors = await getColorSelectionsLoader(deps)
  const colorModel = await loadColors(
    params.orgId,
    params.jobId,
    deps as Parameters<LoadJobColorSelections>[2]
  )
  if (!colorModel.ok) return colorModel

  const readiness = validateWorkOrderGenerationReadiness({
    colorModel: colorModel.data,
    forceWithWarnings: params.input.force_with_warnings,
  })
  if (!readiness.ok) return readiness

  const db = await getDb(deps)
  const changeOrders = await loadAcceptedChangeOrderDeltas(
    db,
    params.orgId,
    params.jobId,
    source.data.source.estimate_snapshot_id
  )
  if (!changeOrders.ok) return changeOrders

  const latest = await loadLatestWorkOrder(
    db,
    params.orgId,
    params.jobId,
    source.data.source.estimate_snapshot_id
  )
  if (latest.error) {
    return errorResult('server_error', latest.error.message ?? 'Unable to inspect work order.')
  }

  const replacing = canReplaceWorkOrder(latest.data ?? null)
  const revisionNumber = replacing ? latest.data!.revision_number : nextRevision(latest.data ?? null)
  const generatedAt = (deps?.now?.() ?? new Date()).toISOString()
  const document = buildWorkOrderDocument({
    source: source.data,
    colorModel: colorModel.data,
    changeOrders: changeOrders.data,
    input: params.input,
    revisionNumber,
    status: 'generated',
    generatedAt,
    warnings: readiness.data,
  })

  const sourceSummary = document.source
  const payload = {
    color_selection_set_id: colorModel.data.selection_set?.id ?? null,
    status: 'generated',
    title: 'Work order',
    accepted_estimate_display_name: source.data.estimate.version_name,
    customer_display_name: customerName(source.data),
    job_display_name: source.data.job.title,
    accepted_total: document.totals.accepted_total,
    change_order_total: document.totals.accepted_change_order_total,
    work_order_total: document.totals.work_order_total,
    document_json: document,
    generated_snapshot_json: document,
    source_summary_json: sourceSummary,
    generated_at: generatedAt,
    locked_at: null,
    issued_at: null,
    voided_at: null,
    updated_by: params.userId,
  }

  if (replacing && latest.data) {
    const updated = await db
      .from('job_work_orders')
      .update(payload)
      .eq('org_id', params.orgId)
      .eq('job_id', params.jobId)
      .eq('id', latest.data.id)
      .in('status', ['draft', 'generated'])
      .select(workOrderSelect)
      .single<JobWorkOrderRow>()
    if (updated.error || !updated.data) {
      return errorResult('server_error', updated.error?.message ?? 'Unable to regenerate work order.')
    }
    return okResult(updated.data)
  }

  const created = await db
    .from('job_work_orders')
    .insert({
      org_id: params.orgId,
      job_id: params.jobId,
      estimate_id: source.data.source.estimate_id,
      estimate_snapshot_id: source.data.source.estimate_snapshot_id,
      revision_number: revisionNumber,
      ...payload,
      created_by: params.userId,
    })
    .select(workOrderSelect)
    .single<JobWorkOrderRow>()
  if (created.error || !created.data) {
    if (isUniqueConflict(created.error)) {
      return errorResult('conflict', 'A work order revision already exists for this accepted estimate.')
    }
    return errorResult('server_error', created.error?.message ?? 'Unable to generate work order.')
  }

  return okResult(created.data)
}

async function setLatestWorkOrderStatus(params: {
  orgId: string
  jobId: string
  userId: string
  status: Extract<JobWorkOrderStatus, 'locked' | 'void'>
}, deps?: WorkOrderDeps): Promise<ServiceResult<JobWorkOrderRow>> {
  const loadAcceptedSource = await getAcceptedEstimateOperationalSourceLoader(deps)
  const source = await loadAcceptedSource(
    { orgId: params.orgId, jobId: params.jobId },
    deps as Parameters<LoadAcceptedEstimateOperationalSource>[1]
  )
  if (!source.ok) return source

  const db = await getDb(deps)
  const latest = await loadLatestWorkOrder(
    db,
    params.orgId,
    params.jobId,
    source.data.source.estimate_snapshot_id
  )
  if (latest.error) {
    return errorResult('server_error', latest.error.message ?? 'Unable to inspect work order.')
  }
  if (!latest.data) return errorResult('not_found', 'Work order not found.')

  if (params.status === 'locked' && latest.data.status !== 'generated') {
    return errorResult('conflict', 'Only generated work orders can be locked.')
  }
  if (params.status === 'void' && latest.data.status === 'void') {
    return errorResult('conflict', 'Work order is already void.')
  }

  const now = (deps?.now?.() ?? new Date()).toISOString()
  const document = {
    ...latest.data.document_json,
    status: params.status,
  }
  const patch =
    params.status === 'locked'
      ? { status: 'locked', locked_at: now, issued_at: now }
      : { status: 'void', voided_at: now }

  const updated = await db
    .from('job_work_orders')
    .update({
      ...patch,
      document_json: document,
      generated_snapshot_json: document,
      updated_by: params.userId,
    })
    .eq('org_id', params.orgId)
    .eq('job_id', params.jobId)
    .eq('id', latest.data.id)
    .select(workOrderSelect)
    .single<JobWorkOrderRow>()
  if (updated.error || !updated.data) {
    return errorResult('server_error', updated.error?.message ?? 'Unable to update work order.')
  }
  return okResult(updated.data)
}

export function lockJobWorkOrder(
  params: { orgId: string; jobId: string; userId: string },
  deps?: WorkOrderDeps
) {
  return setLatestWorkOrderStatus({ ...params, status: 'locked' }, deps)
}

export function voidJobWorkOrder(
  params: { orgId: string; jobId: string; userId: string },
  deps?: WorkOrderDeps
) {
  return setLatestWorkOrderStatus({ ...params, status: 'void' }, deps)
}
