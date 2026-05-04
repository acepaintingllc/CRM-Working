import { asText, type UnsafeRecord as Unsafe } from '../../estimator/parsing.ts'
import { supabaseAdmin } from '../org.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import type { EstimateV2GetResponse } from '../../../types/estimator/v2.ts'

type SnapshotReason = 'accepted' | 'manual_sold' | 'backfill'

type SnapshotRow = {
  id?: string
  org_id: string
  job_id: string
  estimate_id: string
  customer_id: string
  accepted_public_version_id: string | null
  setting_set_id_used: string | null
  snapshot_created_reason: SnapshotReason
  estimate_version_name: string | null
  estimate_version_state: string | null
  estimate_version_kind: string | null
  estimated_labor_hours: number
  estimated_paint_gallons: number
  estimated_primer_gallons: number
  estimated_paint_material_cost: number
  estimated_supplies_cost: number
  estimated_other_cost: number
  estimated_access_cost: number
  estimated_total: number
  assumptions_json: Unsafe
  totals_json: Unsafe
  source_payload_json: Unsafe
  created_by?: string | null
}

type SnapshotLineRow = {
  snapshot_id?: string
  org_id: string
  job_id: string
  estimate_id: string
  line_key: string
  line_kind: 'walls' | 'ceilings' | 'trim' | 'doors' | 'drywall' | 'other' | 'access' | 'policy' | 'summary'
  room_id: string | null
  source_table: string | null
  source_row_id: string | null
  label: string
  position: number
  estimated_labor_hours: number
  estimated_paint_gallons: number
  estimated_primer_gallons: number
  estimated_material_cost: number
  estimated_supply_cost: number
  estimated_total: number
  assumptions_json: Unsafe
  output_json: Unsafe
}

type BuiltSnapshot = {
  snapshot: SnapshotRow
  lines: SnapshotLineRow[]
}

type EnsureSnapshotParams = {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
  acceptedPublicVersionId?: string | null
  reason?: SnapshotReason
}

type DbClient = typeof supabaseAdmin

function asNumber(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function isRecord(value: unknown): value is Unsafe {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): Unsafe[] {
  return Array.isArray(value) ? (value.filter(isRecord) as Unsafe[]) : []
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

function sumRows(rows: Unsafe[], key: string) {
  return rows.reduce((sum, row) => sum + asNumber(row[key]), 0)
}

function rowLabel(row: Unsafe, fallback: string) {
  return (
    asText(row.scope_name) ||
    asText(row.description) ||
    asText(row.customer_label) ||
    asText(row.label) ||
    asText(row.repair_type) ||
    fallback
  )
}

function sourceId(row: Unsafe) {
  return asText(row.id) || null
}

function scopeLine(params: {
  orgId: string
  jobId: string
  estimateId: string
  kind: SnapshotLineRow['line_kind']
  sourceTable: string
  row: Unsafe
  index: number
}) {
  const paintMaterialCost = asNumber(
    params.row.allocated_paint_material_cost ?? params.row.raw_paint_material_cost
  )
  const primerMaterialCost =
    asNumber(params.row.effective_primer_gallons) * asNumber(params.row.primer_price_per_gal)
  return {
    org_id: params.orgId,
    job_id: params.jobId,
    estimate_id: params.estimateId,
    line_key: `${params.kind}:${sourceId(params.row) ?? params.index}`,
    line_kind: params.kind,
    room_id: asText(params.row.room_id) || null,
    source_table: params.sourceTable,
    source_row_id: sourceId(params.row),
    label: rowLabel(params.row, `${params.kind} ${params.index + 1}`),
    position: params.index,
    estimated_labor_hours:
      asNumber(params.row.effective_paint_hours) + asNumber(params.row.effective_primer_hours),
    estimated_paint_gallons: asNumber(params.row.effective_paint_gallons),
    estimated_primer_gallons: asNumber(params.row.effective_primer_gallons),
    estimated_material_cost: paintMaterialCost + primerMaterialCost,
    estimated_supply_cost: asNumber(params.row.effective_supply_cost),
    estimated_total: asNumber(params.row.effective_total),
    assumptions_json: {},
    output_json: jsonClone(params.row),
  } satisfies SnapshotLineRow
}

function accessLine(params: {
  orgId: string
  jobId: string
  estimateId: string
  row: Unsafe
  index: number
}) {
  return {
    org_id: params.orgId,
    job_id: params.jobId,
    estimate_id: params.estimateId,
    line_key: `access:${sourceId(params.row) ?? params.index}`,
    line_kind: 'access',
    room_id: asText(params.row.room_id) || null,
    source_table: 'estimate_access_fees',
    source_row_id: sourceId(params.row),
    label: rowLabel(params.row, `Access ${params.index + 1}`),
    position: params.index,
    estimated_labor_hours: 0,
    estimated_paint_gallons: 0,
    estimated_primer_gallons: 0,
    estimated_material_cost: 0,
    estimated_supply_cost: 0,
    estimated_total: asNumber(params.row.effective_total ?? params.row.total),
    assumptions_json: {},
    output_json: jsonClone(params.row),
  } satisfies SnapshotLineRow
}

function summaryLine(params: {
  orgId: string
  jobId: string
  estimateId: string
  snapshot: SnapshotRow
  pricingSummary: Unsafe
}) {
  return {
    org_id: params.orgId,
    job_id: params.jobId,
    estimate_id: params.estimateId,
    line_key: 'summary:job-total',
    line_kind: 'summary',
    room_id: null,
    source_table: null,
    source_row_id: null,
    label: 'Accepted estimate total',
    position: 10_000,
    estimated_labor_hours: params.snapshot.estimated_labor_hours,
    estimated_paint_gallons: params.snapshot.estimated_paint_gallons,
    estimated_primer_gallons: params.snapshot.estimated_primer_gallons,
    estimated_material_cost: params.snapshot.estimated_paint_material_cost,
    estimated_supply_cost: params.snapshot.estimated_supplies_cost,
    estimated_total: params.snapshot.estimated_total,
    assumptions_json: {},
    output_json: jsonClone(params.pricingSummary),
  } satisfies SnapshotLineRow
}

export function buildEstimateSnapshotRows(params: {
  orgId: string
  estimateResponse: EstimateV2GetResponse
  job: Unsafe
  publicVersion?: Unsafe | null
  reason?: SnapshotReason
  createdBy?: string | null
}): BuiltSnapshot {
  const estimate = params.estimateResponse.estimate as Unsafe
  const inputs = params.estimateResponse.inputs
  const pricing = (params.estimateResponse.pricing_summary ?? {}) as Unsafe
  const walls = asArray(params.estimateResponse.wall_calculations?.scopes)
  const ceilings = asArray(params.estimateResponse.ceiling_calculations?.scopes)
  const trim = asArray(params.estimateResponse.trim_calculations?.scopes)
  const doors = asArray(params.estimateResponse.door_calculations?.scopes)
  const drywall = asArray(params.estimateResponse.drywall_calculations?.scopes)
  const other = asArray((params.estimateResponse.inputs as Unsafe).other)
  const accessFees = asArray((params.estimateResponse.inputs as Unsafe).access_fees)
  const allScopeRows = [...walls, ...ceilings, ...trim, ...doors, ...drywall, ...other]
  const jobId = asText(estimate.job_id)
  const estimateId = asText(estimate.id)
  const customerId = asText((estimate as Unsafe).customer_id) || asText(params.job.customer_id)
  const acceptedPublicVersionId =
    asText(params.publicVersion?.id) || asText((estimate as Unsafe).accepted_public_version_id) || null
  const sourcePayload = {
    estimate,
    job: params.job,
    public_version: params.publicVersion ?? null,
    customer_send_snapshot_json: isRecord(params.publicVersion?.snapshot_json)
      ? params.publicVersion?.snapshot_json
      : {},
    inputs,
  }
  const snapshot: SnapshotRow = {
    org_id: params.orgId,
    job_id: jobId,
    estimate_id: estimateId,
    customer_id: customerId,
    accepted_public_version_id: acceptedPublicVersionId,
    setting_set_id_used: asText((estimate as Unsafe).setting_set_id_used) || null,
    snapshot_created_reason: params.reason ?? 'accepted',
    estimate_version_name: asText(estimate.version_name) || null,
    estimate_version_state: asText(estimate.version_state) || null,
    estimate_version_kind: asText(estimate.version_kind) || null,
    estimated_labor_hours: asNumber(pricing.effectiveLaborHours ?? pricing.rawLaborHours),
    estimated_paint_gallons: sumRows(allScopeRows, 'effective_paint_gallons'),
    estimated_primer_gallons: sumRows(allScopeRows, 'effective_primer_gallons'),
    estimated_paint_material_cost:
      asNumber(pricing.paintMaterialCost) + asNumber(pricing.primerMaterialCost),
    estimated_supplies_cost: asNumber(pricing.supplyCost),
    estimated_other_cost: sumRows(other, 'effective_total'),
    estimated_access_cost: asNumber(pricing.sharedAccessCost) || sumRows(accessFees, 'effective_total'),
    estimated_total: asNumber(pricing.finalTotal),
    assumptions_json: jsonClone({
      jobsettings: inputs.jobsettings ?? {},
      org_defaults: inputs.org_defaults ?? {},
    }),
    totals_json: jsonClone({
      pricing_summary: pricing,
      wall_calculations: params.estimateResponse.wall_calculations ?? {},
      ceiling_calculations: params.estimateResponse.ceiling_calculations ?? {},
      trim_calculations: params.estimateResponse.trim_calculations ?? {},
      door_calculations: params.estimateResponse.door_calculations ?? {},
      drywall_calculations: params.estimateResponse.drywall_calculations ?? {},
      trim_paint: params.estimateResponse.trim_paint ?? null,
    }),
    source_payload_json: jsonClone(sourcePayload),
    created_by: params.createdBy ?? null,
  }

  const scopeLines = [
    ...walls.map((row, index) =>
      scopeLine({
        orgId: params.orgId,
        jobId,
        estimateId,
        kind: 'walls',
        sourceTable: 'estimate_room_wall_scopes',
        row,
        index,
      })
    ),
    ...ceilings.map((row, index) =>
      scopeLine({
        orgId: params.orgId,
        jobId,
        estimateId,
        kind: 'ceilings',
        sourceTable: 'estimate_room_ceiling_scopes',
        row,
        index: 1_000 + index,
      })
    ),
    ...trim.map((row, index) =>
      scopeLine({
        orgId: params.orgId,
        jobId,
        estimateId,
        kind: 'trim',
        sourceTable: 'estimate_room_trim_scopes',
        row,
        index: 2_000 + index,
      })
    ),
    ...doors.map((row, index) =>
      scopeLine({
        orgId: params.orgId,
        jobId,
        estimateId,
        kind: 'doors',
        sourceTable: 'estimate_room_door_scopes',
        row,
        index: 3_000 + index,
      })
    ),
    ...drywall.map((row, index) =>
      scopeLine({
        orgId: params.orgId,
        jobId,
        estimateId,
        kind: 'drywall',
        sourceTable: 'estimate_drywall_repairs',
        row,
        index: 4_000 + index,
      })
    ),
    ...other.map((row, index) =>
      scopeLine({
        orgId: params.orgId,
        jobId,
        estimateId,
        kind: 'other',
        sourceTable: 'estimate_other',
        row,
        index: 5_000 + index,
      })
    ),
    ...accessFees.map((row, index) =>
      accessLine({
        orgId: params.orgId,
        jobId,
        estimateId,
        row,
        index: 6_000 + index,
      })
    ),
  ]

  return {
    snapshot,
    lines: [
      ...scopeLines,
      summaryLine({
        orgId: params.orgId,
        jobId,
        estimateId,
        snapshot,
        pricingSummary: pricing,
      }),
    ],
  }
}

function isDuplicateEstimateSnapshotMessage(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('duplicate key') || normalized.includes('estimate_snapshot_org_id_estimate_id_key')
}

function isIncompleteSnapshotMessage(message: string) {
  return message.toLowerCase().includes('existing estimate snapshot is incomplete')
}

async function loadExistingSnapshot(db: DbClient, orgId: string, estimateId: string) {
  return db
    .from('estimate_snapshot')
    .select('*')
    .eq('org_id', orgId)
    .eq('estimate_id', estimateId)
    .maybeSingle()
}

export async function insertEstimateSnapshotIfMissing(
  db: DbClient,
  built: BuiltSnapshot
): Promise<ServiceResult<Unsafe>> {
  const inserted = await db.rpc('insert_estimate_snapshot_with_lines', {
    p_snapshot: built.snapshot,
    p_lines: built.lines,
  })
  if (inserted.error) {
    const message = inserted.error.message ?? 'Unable to create estimate snapshot'
    if (isDuplicateEstimateSnapshotMessage(message)) {
      const racedExisting = await loadExistingSnapshot(
        db,
        built.snapshot.org_id,
        built.snapshot.estimate_id
      )
      if (racedExisting.error) {
        return errorResult(
          'server_error',
          racedExisting.error.message ?? 'Unable to load existing estimate snapshot'
        )
      }
      if (racedExisting.data) return okResult(racedExisting.data as Unsafe)
    }
    if (isIncompleteSnapshotMessage(message)) {
      return errorResult(
        'invalid_input',
        'Existing estimate snapshot is incomplete and cannot be used for actuals.'
      )
    }
    return errorResult('server_error', message)
  }

  return okResult(inserted.data as Unsafe)
}

async function loadSnapshotJob(params: { db: DbClient; orgId: string; jobId: string }) {
  return params.db
    .from('jobs')
    .select('id, customer_id, title, status, linked_estimate_id')
    .eq('org_id', params.orgId)
    .eq('id', params.jobId)
    .maybeSingle()
}

async function loadSnapshotPublicVersion(params: {
  db: DbClient
  orgId: string
  publicVersionId: string | null | undefined
}) {
  const id = asText(params.publicVersionId)
  if (!id) return { data: null, error: null }
  return params.db
    .from('estimate_public_versions')
    .select('id, estimate_id, version_number, status, accepted_at, snapshot_json')
    .eq('org_id', params.orgId)
    .eq('id', id)
    .maybeSingle()
}

export async function ensureEstimateSnapshotForAcceptedEstimate(
  params: EnsureSnapshotParams
): Promise<ServiceResult<Unsafe>> {
  const db = supabaseAdmin
  const existing = await loadExistingSnapshot(db, params.orgId, params.estimateId)
  if (existing.error) {
    return errorResult(
      'server_error',
      existing.error.message ?? 'Unable to inspect estimate snapshot'
    )
  }
  if (existing.data) return okResult(existing.data as Unsafe)

  let estimateResponse: EstimateV2GetResponse
  try {
    const { loadEstimateV2Response } = await import('../estimate-v2/loadEstimateAssembly.ts')
    estimateResponse = await loadEstimateV2Response(params)
  } catch (error) {
    return errorResult(
      'server_error',
      error instanceof Error ? error.message : 'Unable to load estimate snapshot source'
    )
  }

  const jobId = asText((estimateResponse.estimate as Unsafe).job_id)
  const [jobResult, publicVersionResult] = await Promise.all([
    loadSnapshotJob({ db, orgId: params.orgId, jobId }),
    loadSnapshotPublicVersion({
      db,
      orgId: params.orgId,
      publicVersionId:
        params.acceptedPublicVersionId ??
        asText((estimateResponse.estimate as Unsafe).accepted_public_version_id),
    }),
  ])

  if (jobResult.error || !jobResult.data) {
    return errorResult(
      'server_error',
      jobResult.error?.message ?? 'Accepted estimate job missing'
    )
  }
  if (publicVersionResult.error) {
    return errorResult(
      'server_error',
      publicVersionResult.error.message ?? 'Unable to load accepted public version'
    )
  }

  return insertEstimateSnapshotIfMissing(
    db,
    buildEstimateSnapshotRows({
      orgId: params.orgId,
      estimateResponse,
      job: jobResult.data as Unsafe,
      publicVersion: (publicVersionResult.data as Unsafe | null) ?? null,
      reason: params.reason ?? 'accepted',
      createdBy: params.userId,
    })
  )
}
