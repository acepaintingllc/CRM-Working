import type {
  AcceptedEstimateSnapshotArtifactState,
  CanonicalAcceptedEstimateSource,
  AcceptedEstimateOperationalSource,
  AcceptedEstimateRepairSource,
  AcceptedEstimateOperationalSourcePayload,
  AcceptedEstimateSourcePublicVersion,
  AcceptedEstimateAccessFeeRow,
  AcceptEstimateOperationalInput,
} from './types.ts'
import {
  ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_KIND,
  ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_VERSION,
} from './types.ts'
import {
  errorResult,
  okResult,
  type ServiceError,
  type ServiceResult,
} from '../serviceResult.ts'
import { normalizeEstimatePublicAcceptanceRecord } from '../../customer-estimates/publicAcceptance.ts'
import {
  readEstimatePublicPersistedSnapshotState,
} from '../../customer-estimates/publicVersionSnapshot.ts'

type Unsafe = Record<string, unknown>

type DbMaybeSingleResponse = Promise<{
  data: Unsafe | null
  error: { message?: string } | null
}>

type DbReadFilterChain = {
  eq(column: string, value: unknown): DbReadFilterChain
  not(column: string, operator: string, value: unknown): DbReadFilterChain
  order(
    column: string,
    options?: {
      ascending?: boolean
    }
  ): DbReadFilterChain
  limit(count: number): DbReadFilterChain
  maybeSingle(): DbMaybeSingleResponse
}

type DbReadChain = {
  from(table: string): {
    select(columns: string): DbReadFilterChain
  }
}

type DbUpdateChain = {
  from(table: string): {
    update(payload: Record<string, unknown>): {
      eq(column: string, value: unknown): {
        eq(
          column: string,
          value: unknown
        ): {
          eq(column: string, value: unknown): {
            select(columns: string): {
              maybeSingle(): DbMaybeSingleResponse
            }
          }
          is(column: string, value: unknown): {
            select(columns: string): {
              maybeSingle(): DbMaybeSingleResponse
            }
          }
          select(columns: string): {
            maybeSingle(): DbMaybeSingleResponse
          }
        }
      }
    }
  }
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function asFiniteNumber(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNullableRecord(value: unknown) {
  return isRecord(value) ? value : null
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value ?? null)) as T
}

const REQUIRED_OPERATIONAL_INPUT_ARRAYS = [
  'rooms',
  'room_wall_scopes',
  'room_ceiling_scopes',
  'room_trim_scopes',
  'room_door_scopes',
  'drywall_repairs',
  'access_fees',
  'prejob',
] as const

const REQUIRED_OPERATIONAL_PRICING_OBJECTS = [
  'pricing_summary',
  'wall_calculations',
  'ceiling_calculations',
  'trim_calculations',
  'door_calculations',
  'drywall_calculations',
] as const

type AcceptedEstimateResolutionSource = 'job_link' | 'legacy_job_estimate_fallback'

type OperationalAcceptedEstimateResolution = {
  operationalEstimateId: string
  resolutionSource: AcceptedEstimateResolutionSource
}

const acceptedEstimateColumns =
  'id, org_id, job_id, customer_id, version_name, version_state, accepted_at, accepted_public_version_id'
const acceptedEstimateSnapshotColumns =
  'id, org_id, job_id, estimate_id, customer_id, accepted_public_version_id, estimate_version_name, estimate_version_state, estimated_labor_hours, estimated_paint_gallons, estimated_supplies_cost, estimated_access_cost, estimated_other_cost, estimated_total, source_payload_json'

function readAcceptedSnapshotPayload(snapshot: Unsafe) {
  return asNullableRecord(snapshot.source_payload_json)
}

function readAcceptedSnapshotEmbeddedAcceptedPublicVersion(snapshot: Unsafe) {
  return asNullableRecord(readAcceptedSnapshotPayload(snapshot)?.accepted_public_version)
}

function readAcceptedSnapshotLegacyEmbeddedPublicVersion(snapshot: Unsafe) {
  return asNullableRecord(readAcceptedSnapshotPayload(snapshot)?.public_version)
}

function readAcceptedSnapshotLegacyEmbeddedCustomerArtifact(snapshot: Unsafe) {
  return asNullableRecord(readAcceptedSnapshotPayload(snapshot)?.customer_send_snapshot_json)
}

function hasAcceptedSnapshotPublicVersionDetails(
  publicVersion: Record<string, unknown> | null
): publicVersion is AcceptedEstimateSourcePublicVersion {
  if (!publicVersion) return false

  return (
    typeof publicVersion.version_number !== 'undefined' &&
    'public_token' in publicVersion &&
    Boolean(asText(publicVersion.accepted_at)) &&
    'acceptance_json' in publicVersion
  )
}

function normalizeAcceptedEstimateAccessFeeRow(
  row: Record<string, unknown>
): AcceptedEstimateAccessFeeRow {
  const normalized = jsonClone(row) as AcceptedEstimateAccessFeeRow

  if ('id' in row) normalized.id = jsonClone(row.id) as AcceptedEstimateAccessFeeRow['id']
  if ('room_id' in row) normalized.room_id = jsonClone(row.room_id) as AcceptedEstimateAccessFeeRow['room_id']
  if ('access_fee_id' in row) {
    normalized.access_fee_id = jsonClone(
      row.access_fee_id
    ) as AcceptedEstimateAccessFeeRow['access_fee_id']
  }
  if ('label' in row) normalized.label = jsonClone(row.label) as AcceptedEstimateAccessFeeRow['label']
  if ('display_name' in row) {
    normalized.display_name = jsonClone(
      row.display_name
    ) as AcceptedEstimateAccessFeeRow['display_name']
  }
  if ('access_group' in row) {
    normalized.access_group = jsonClone(row.access_group) as AcceptedEstimateAccessFeeRow['access_group']
  }
  if ('qty' in row) normalized.qty = jsonClone(row.qty) as AcceptedEstimateAccessFeeRow['qty']
  if ('catalog_amount' in row) {
    normalized.catalog_amount = jsonClone(
      row.catalog_amount
    ) as AcceptedEstimateAccessFeeRow['catalog_amount']
  }
  if ('amount' in row) normalized.amount = jsonClone(row.amount) as AcceptedEstimateAccessFeeRow['amount']
  if ('actual_cost_override' in row) {
    normalized.actual_cost_override = jsonClone(
      row.actual_cost_override
    ) as AcceptedEstimateAccessFeeRow['actual_cost_override']
  }
  if ('calculated_total' in row) {
    normalized.calculated_total = jsonClone(
      row.calculated_total
    ) as AcceptedEstimateAccessFeeRow['calculated_total']
  }
  if ('effective_total' in row) {
    normalized.effective_total = jsonClone(
      row.effective_total
    ) as AcceptedEstimateAccessFeeRow['effective_total']
  }
  if ('final_total' in row) {
    normalized.final_total = jsonClone(row.final_total) as AcceptedEstimateAccessFeeRow['final_total']
  }
  if ('override_total' in row) {
    normalized.override_total = jsonClone(
      row.override_total
    ) as AcceptedEstimateAccessFeeRow['override_total']
  }
  if ('overridden' in row) {
    normalized.overridden = jsonClone(row.overridden) as AcceptedEstimateAccessFeeRow['overridden']
  }
  if ('notes' in row) normalized.notes = jsonClone(row.notes) as AcceptedEstimateAccessFeeRow['notes']
  if ('position' in row) {
    normalized.position = jsonClone(row.position) as AcceptedEstimateAccessFeeRow['position']
  }

  return normalized
}

function readAcceptedEstimateAccessFeeRows(value: unknown): AcceptedEstimateAccessFeeRow[] | null {
  if (!Array.isArray(value)) return null

  const rows: AcceptedEstimateAccessFeeRow[] = []
  for (const row of value) {
    if (!isRecord(row)) return null
    rows.push(normalizeAcceptedEstimateAccessFeeRow(row))
  }
  return rows
}

function buildOperationalSourceFromInternalEstimate(
  value: unknown
): AcceptedEstimateOperationalSource | null {
  if (!isRecord(value)) return null
  const inputs = asNullableRecord(value.inputs)
  const pricing = asNullableRecord(value.pricing)
  if (!inputs || !pricing) return null

  for (const key of REQUIRED_OPERATIONAL_INPUT_ARRAYS) {
    if (!Array.isArray(inputs[key])) return null
  }

  for (const key of REQUIRED_OPERATIONAL_PRICING_OBJECTS) {
    if (!isRecord(pricing[key])) return null
  }

  const finalTotal = asFiniteNumber(pricing.final_total)
  if (finalTotal == null) return null
  const accessFees = readAcceptedEstimateAccessFeeRows(inputs.access_fees)
  if (!accessFees) return null

  return {
    rooms: jsonClone(inputs.rooms as AcceptedEstimateOperationalSource['rooms']),
    room_wall_scopes: jsonClone(
      inputs.room_wall_scopes as AcceptedEstimateOperationalSource['room_wall_scopes']
    ),
    room_ceiling_scopes: jsonClone(
      inputs.room_ceiling_scopes as AcceptedEstimateOperationalSource['room_ceiling_scopes']
    ),
    room_trim_scopes: jsonClone(
      inputs.room_trim_scopes as AcceptedEstimateOperationalSource['room_trim_scopes']
    ),
    room_door_scopes: jsonClone(
      inputs.room_door_scopes as AcceptedEstimateOperationalSource['room_door_scopes']
    ),
    drywall_repairs: jsonClone(
      inputs.drywall_repairs as AcceptedEstimateOperationalSource['drywall_repairs']
    ),
    access_fees: accessFees,
    prejob: jsonClone(inputs.prejob as AcceptedEstimateOperationalSource['prejob']),
    pricing_summary: jsonClone(
      pricing.pricing_summary as AcceptedEstimateOperationalSource['pricing_summary']
    ),
    final_total: finalTotal,
    wall_calculations: jsonClone(
      pricing.wall_calculations as AcceptedEstimateOperationalSource['wall_calculations']
    ),
    ceiling_calculations: jsonClone(
      pricing.ceiling_calculations as AcceptedEstimateOperationalSource['ceiling_calculations']
    ),
    trim_calculations: jsonClone(
      pricing.trim_calculations as AcceptedEstimateOperationalSource['trim_calculations']
    ),
    door_calculations: jsonClone(
      pricing.door_calculations as AcceptedEstimateOperationalSource['door_calculations']
    ),
    drywall_calculations: jsonClone(
      pricing.drywall_calculations as AcceptedEstimateOperationalSource['drywall_calculations']
    ),
  }
}

function readAcceptedSnapshotOperationalSourcePayload(
  sourcePayload: Record<string, unknown> | null,
  artifact: unknown,
  acceptedPublicVersion: Record<string, unknown> | null
): { sourcePayload: AcceptedEstimateOperationalSourcePayload; operationalSource: AcceptedEstimateOperationalSource } | null {
  if (!sourcePayload) return null
  const operationalSource = buildOperationalSourceFromInternalEstimate(
    sourcePayload.internal_operational_estimate
  )
  if (
    asText(sourcePayload.artifact_kind) === ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_KIND &&
    asNumber(sourcePayload.artifact_version) ===
      ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_VERSION &&
    artifact &&
    hasAcceptedSnapshotPublicVersionDetails(acceptedPublicVersion) &&
    operationalSource
  ) {
    return {
      sourcePayload: {
        ...(sourcePayload as Record<string, unknown>),
        artifact_kind: ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_KIND,
        artifact_version: ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_VERSION,
        customer_artifact: artifact as AcceptedEstimateOperationalSourcePayload['customer_artifact'],
        customer_visible_source: 'customer_artifact.document',
        accepted_public_version: acceptedPublicVersion,
        internal_operational_estimate:
          sourcePayload.internal_operational_estimate as AcceptedEstimateOperationalSourcePayload['internal_operational_estimate'],
      },
      operationalSource,
    }
  }
  return null
}

function readAcceptedEstimateSnapshotArtifactState(
  snapshot: Unsafe
): AcceptedEstimateSnapshotArtifactState {
  const sourcePayload = readAcceptedSnapshotPayload(snapshot)
  const legacyArtifact = readAcceptedSnapshotLegacyEmbeddedCustomerArtifact(snapshot)
  const legacyPublicVersion = readAcceptedSnapshotLegacyEmbeddedPublicVersion(snapshot)
  if (legacyArtifact || legacyPublicVersion) {
    return {
      kind: 'legacy',
      message:
        'Accepted estimate snapshot payload is legacy. Repair the snapshot before loading accepted estimate data.',
    }
  }

  const artifactState = readEstimatePublicPersistedSnapshotState(
    readAcceptedSnapshotPayload(snapshot)?.customer_artifact ?? null
  )
  if (artifactState.kind === 'missing') {
    return {
      kind: 'missing',
      message:
        'Accepted estimate snapshot customer artifact is missing. Repair the snapshot before loading accepted estimate data.',
    }
  }
  if (artifactState.kind === 'invalid') {
    return {
      kind: 'invalid',
      message:
        'Accepted estimate snapshot customer artifact is unreadable. Repair the snapshot before loading accepted estimate data.',
    }
  }
  if (artifactState.kind === 'legacy') {
    return {
      kind: 'legacy',
      message:
        'Accepted estimate snapshot customer artifact is legacy. Repair the snapshot before loading accepted estimate data.',
    }
  }

  const acceptedPublicVersion = readAcceptedSnapshotEmbeddedAcceptedPublicVersion(snapshot)
  const sourcePayloadState = readAcceptedSnapshotOperationalSourcePayload(
    sourcePayload,
    artifactState.snapshot,
    acceptedPublicVersion
  )
  if (!hasAcceptedSnapshotPublicVersionDetails(acceptedPublicVersion)) {
    return {
      kind: 'legacy',
      message:
        'Accepted estimate snapshot payload is incomplete. Repair the snapshot before loading accepted estimate data.',
    }
  }
  if (!sourcePayloadState) {
    return {
      kind: 'legacy',
      message:
        'Accepted estimate snapshot operational source payload is missing or incomplete. Repair the snapshot before loading accepted estimate data.',
    }
  }

  return {
    kind: 'canonical',
    artifact: artifactState.snapshot,
    source_payload: sourcePayloadState.sourcePayload,
    operational_source: sourcePayloadState.operationalSource,
    accepted_public_version: acceptedPublicVersion,
  }
}

function buildAcceptedEstimateSnapshotReadFailure(
  artifactState: Exclude<AcceptedEstimateSnapshotArtifactState, { kind: 'canonical' }>
) {
  return errorResult('invalid_input', artifactState.message)
}

function buildAcceptedEstimateSnapshotRepairFailure(
  artifactState: Exclude<AcceptedEstimateSnapshotArtifactState, { kind: 'canonical' }>
) {
  const repairProblem =
    artifactState.kind === 'missing'
      ? 'missing its customer artifact'
      : artifactState.kind === 'invalid'
        ? 'unreadable'
        : 'legacy or incomplete'

  return errorResult(
    'invalid_input',
    `Accepted estimate snapshot is ${repairProblem} and cannot be repaired in place because snapshot rows are immutable. Run an additive snapshot replacement migration.`
  )
}

function readAcceptedCustomerVisibleTotal(
  artifactState: Extract<AcceptedEstimateSnapshotArtifactState, { kind: 'canonical' }>
) {
  return asNumber(artifactState.artifact.document?.total)
}

function forwardServiceError<T>(result: ServiceError): ServiceResult<T> {
  return result
}

async function loadJobLinkedAcceptedEstimateResolution(
  db: DbReadChain,
  orgId: string,
  jobId: string
): Promise<ServiceResult<OperationalAcceptedEstimateResolution | null>> {
  const jobResult = await db
    .from('jobs')
    .select('id, linked_estimate_id')
    .eq('org_id', orgId)
    .eq('id', jobId)
    .maybeSingle()

  if (jobResult.error) {
    return errorResult('server_error', jobResult.error.message ?? 'Unable to load job')
  }
  if (!jobResult.data) {
    return errorResult('not_found', 'Job not found')
  }

  const operationalEstimateId = asText(jobResult.data.linked_estimate_id)
  if (!operationalEstimateId) {
    return okResult(null)
  }

  return okResult({
    operationalEstimateId,
    resolutionSource: 'job_link',
  })
}

async function loadLegacyAcceptedEstimateFallbackResolution(
  db: DbReadChain,
  orgId: string,
  jobId: string
): Promise<ServiceResult<OperationalAcceptedEstimateResolution | null>> {
  // Legacy compatibility only: some historical accepted jobs predate
  // jobs.linked_estimate_id. This is the single canonical fallback path for
  // resolving operational accepted-estimate ownership when the job link is
  // missing.
  let legacyFallbackQuery = db
    .from('estimates')
    .select(acceptedEstimateColumns)
    .eq('org_id', orgId)
    .eq('job_id', jobId)

  legacyFallbackQuery = legacyFallbackQuery
    .not('accepted_public_version_id', 'is', null)
    .not('accepted_at', 'is', null)
    .order('accepted_at', { ascending: false })
    .limit(1)

  const legacyFallbackResult = await legacyFallbackQuery.maybeSingle()
  if (legacyFallbackResult.error) {
    return errorResult(
      'server_error',
      legacyFallbackResult.error.message ?? 'Unable to resolve accepted estimate'
    )
  }

  const operationalEstimateId = asText(legacyFallbackResult.data?.id)
  if (!operationalEstimateId) {
    return okResult(null)
  }

  return okResult({
    operationalEstimateId,
    resolutionSource: 'legacy_job_estimate_fallback',
  })
}

async function resolveOperationalAcceptedEstimateForJob(
  db: DbReadChain,
  orgId: string,
  jobId: string
): Promise<ServiceResult<OperationalAcceptedEstimateResolution>> {
  // Operational accepted-estimate ownership is anchored to
  // jobs.linked_estimate_id. Only when that canonical link is absent do we
  // allow the documented legacy accepted-estimate fallback.
  const linkedResolution = await loadJobLinkedAcceptedEstimateResolution(db, orgId, jobId)
  if (!linkedResolution.ok) return linkedResolution
  if (linkedResolution.data) return okResult(linkedResolution.data)

  const legacyResolution = await loadLegacyAcceptedEstimateFallbackResolution(db, orgId, jobId)
  if (!legacyResolution.ok) return legacyResolution
  if (legacyResolution.data) return okResult(legacyResolution.data)

  return errorResult('invalid_input', 'Job has no accepted estimate')
}

export function buildAcceptedEstimateUpdatePlan(input: AcceptEstimateOperationalInput) {
  return {
    estimateUpdate: {
      accepted_at: input.acceptedAt,
      accepted_public_version_id: input.publicVersionId,
      version_state: 'live',
    },
    jobUpdate: {
      linked_estimate_id: input.estimateId,
    },
  }
}

export function buildAcceptedEstimateSource(params: {
  estimate: Unsafe
  publicVersion: Unsafe
  rollup?: Unsafe | null
}): AcceptedEstimateRepairSource {
  const snapshotState = readEstimatePublicPersistedSnapshotState(
    params.publicVersion.snapshot_json
  )
  const acceptance = normalizeEstimatePublicAcceptanceRecord(params.publicVersion.acceptance_json)
  const snapshotJson =
    snapshotState.kind === 'canonical' || snapshotState.kind === 'legacy'
      ? snapshotState.snapshot
      : null
  const customerVisibleTotal =
    snapshotState.kind === 'canonical'
      ? asNumber(snapshotState.snapshot.document?.total)
      : asNumber(params.rollup?.final_total)

  return {
    org_id: asText(params.estimate.org_id),
    job_id: asText(params.estimate.job_id),
    estimate_id: asText(params.estimate.id),
    customer_id: asText(params.estimate.customer_id) || null,
    accepted_public_version_id: asText(params.estimate.accepted_public_version_id),
    public_version_number: asNumber(params.publicVersion.version_number),
    public_token: asText(params.publicVersion.public_token) || null,
    accepted_at: asText(params.estimate.accepted_at),
    accepted_by_legal_name: acceptance?.legal_name ?? null,
    signature_type: acceptance?.signature_type ?? null,
    user_agent: acceptance?.user_agent ?? null,
    ip: acceptance?.ip ?? null,
    version_name: asText(params.estimate.version_name) || null,
    version_state: asText(params.estimate.version_state) || null,
    estimate_snapshot_id: null,
    estimated_labor_hours: 0,
    estimated_paint_gallons: 0,
    estimated_supplies_cost: 0,
    estimated_access_cost: 0,
    estimated_other_cost: 0,
    final_total: customerVisibleTotal,
    snapshot_json: snapshotJson ?? {},
    source_payload_json: {},
  }
}

type RepairSnapshotDeps = {
  db?: DbReadChain
  ensureSnapshot?: typeof ensureAcceptedEstimateOperationalSnapshot
}

type AcceptedEstimateOperationalRecord = {
  estimate: Unsafe
  publicVersionId: string
  operationalEstimateId: string
  resolutionSource: AcceptedEstimateResolutionSource
}

export function buildAcceptedEstimateSourceFromSnapshot(params: {
  estimate: Unsafe
  snapshot: Unsafe
  artifactState: Extract<AcceptedEstimateSnapshotArtifactState, { kind: 'canonical' }>
}): CanonicalAcceptedEstimateSource {
  const publicVersion = params.artifactState.accepted_public_version
  const acceptance = normalizeEstimatePublicAcceptanceRecord(publicVersion?.acceptance_json)
  const sourcePayload = params.artifactState.source_payload

  return {
    org_id: asText(params.snapshot.org_id) || asText(params.estimate.org_id),
    job_id: asText(params.snapshot.job_id) || asText(params.estimate.job_id),
    estimate_id: asText(params.snapshot.estimate_id) || asText(params.estimate.id),
    customer_id:
      asText(params.snapshot.customer_id) || asText(params.estimate.customer_id) || null,
    accepted_public_version_id:
      asText(params.snapshot.accepted_public_version_id) ||
      asText(params.estimate.accepted_public_version_id),
    public_version_number: asNumber(publicVersion?.version_number),
    public_token: asText(publicVersion?.public_token) || null,
    accepted_at:
      asText(publicVersion?.accepted_at) || asText(params.estimate.accepted_at),
    accepted_by_legal_name: acceptance?.legal_name ?? null,
    signature_type: acceptance?.signature_type ?? null,
    user_agent: acceptance?.user_agent ?? null,
    ip: acceptance?.ip ?? null,
    version_name:
      asText(params.snapshot.estimate_version_name) ||
      asText(params.estimate.version_name) ||
      null,
    version_state:
      asText(params.snapshot.estimate_version_state) ||
      asText(params.estimate.version_state) ||
      null,
    estimate_snapshot_id: asText(params.snapshot.id) || null,
    estimated_labor_hours: asNumber(params.snapshot.estimated_labor_hours),
    estimated_paint_gallons: asNumber(params.snapshot.estimated_paint_gallons),
    estimated_supplies_cost: asNumber(params.snapshot.estimated_supplies_cost),
    estimated_access_cost: asNumber(params.snapshot.estimated_access_cost),
    estimated_other_cost: asNumber(params.snapshot.estimated_other_cost),
    final_total: readAcceptedCustomerVisibleTotal(params.artifactState),
    snapshot_json: jsonClone(params.artifactState.artifact as Record<string, unknown>),
    source_payload_json: jsonClone(sourcePayload),
    operational_source: jsonClone(params.artifactState.operational_source),
  }
}

export async function applyAcceptedEstimateSideEffects(
  db: DbUpdateChain,
  input: AcceptEstimateOperationalInput
): Promise<ServiceResult<{ ok: true }>> {
  const plan = buildAcceptedEstimateUpdatePlan(input)

  const unownedEstimateUpdate = await db
    .from('estimates')
    .update(plan.estimateUpdate)
    .eq('org_id', input.orgId)
    .eq('id', input.estimateId)
    .is('accepted_public_version_id', null)
    .select('id')
    .maybeSingle()

  if (unownedEstimateUpdate.error) {
    return errorResult(
      'server_error',
      unownedEstimateUpdate.error.message ?? 'Unable to mark estimate accepted'
    )
  }
  let estimateUpdate = unownedEstimateUpdate
  if (!estimateUpdate.data) {
    estimateUpdate = await db
      .from('estimates')
      .update(plan.estimateUpdate)
      .eq('org_id', input.orgId)
      .eq('id', input.estimateId)
      .eq('accepted_public_version_id', input.publicVersionId)
      .select('id')
      .maybeSingle()

    if (estimateUpdate.error) {
      return errorResult(
        'server_error',
        estimateUpdate.error.message ?? 'Unable to mark estimate accepted'
      )
    }
  }
  if (!estimateUpdate.data) {
    return errorResult(
      'conflict',
      'Estimate is already accepted by another public version'
    )
  }

  const jobUpdate = await db
    .from('jobs')
    .update(plan.jobUpdate)
    .eq('org_id', input.orgId)
    .eq('id', input.jobId)
    .select('id')
    .maybeSingle()

  if (jobUpdate.error) {
    return errorResult(
      'server_error',
      jobUpdate.error.message ?? 'Unable to link accepted estimate to job'
    )
  }
  if (!jobUpdate.data) {
    return errorResult('server_error', 'Accepted estimate job missing')
  }

  return okResult({ ok: true })
}

async function loadAcceptedEstimateOperationalRecord(
  db: DbReadChain,
  orgId: string,
  jobId: string
): Promise<ServiceResult<AcceptedEstimateOperationalRecord>> {
  const acceptedEstimateResolution = await resolveOperationalAcceptedEstimateForJob(
    db,
    orgId,
    jobId
  )
  if (!acceptedEstimateResolution.ok) return forwardServiceError(acceptedEstimateResolution)
  const operationalEstimateId = acceptedEstimateResolution.data.operationalEstimateId

  const estimateResult = await db
    .from('estimates')
    .select(acceptedEstimateColumns)
    .eq('org_id', orgId)
    .eq('id', operationalEstimateId)
    .maybeSingle()

  if (estimateResult.error) {
    return errorResult(
      'server_error',
      estimateResult.error.message ?? 'Unable to load accepted estimate'
    )
  }
  if (!estimateResult.data) {
    return errorResult('not_found', 'Accepted estimate not found')
  }

  if (asText(estimateResult.data.job_id) !== jobId) {
    return errorResult(
      'invalid_input',
      acceptedEstimateResolution.data.resolutionSource === 'job_link'
        ? 'Linked estimate does not belong to job'
        : 'Accepted estimate does not belong to job'
    )
  }

  const acceptedAt = asText(estimateResult.data.accepted_at)
  const publicVersionId = asText(estimateResult.data.accepted_public_version_id)
  if (!acceptedAt || !publicVersionId) {
    return errorResult(
      'invalid_input',
      acceptedEstimateResolution.data.resolutionSource === 'job_link'
        ? 'Linked estimate is not accepted'
        : 'Accepted estimate is not accepted'
    )
  }

  return okResult({
    estimate: estimateResult.data,
    publicVersionId,
    operationalEstimateId,
    resolutionSource: acceptedEstimateResolution.data.resolutionSource,
  })
}

async function loadAcceptedEstimateSnapshotRow(
  db: DbReadChain,
  orgId: string,
  operationalEstimateId: string
) {
  return db
    .from('estimate_snapshot')
    .select(acceptedEstimateSnapshotColumns)
    .eq('org_id', orgId)
    .eq('estimate_id', operationalEstimateId)
    .maybeSingle()
}

function hasAcceptedEstimateSnapshotOwnership(params: {
  snapshot: Unsafe
  jobId: string
  operationalEstimateId: string
}) {
  return (
    asText(params.snapshot.job_id) === params.jobId &&
    asText(params.snapshot.estimate_id) === params.operationalEstimateId
  )
}

export async function ensureAcceptedEstimateOperationalSnapshot(input: {
  requestOrigin: string
  orgId: string
  userId: string
  estimateId: string
  publicVersionId: string
}) {
  const { ensureEstimateSnapshotForAcceptedEstimate } = await import(
    '../estimate-feedback/snapshots.ts'
  )
  return ensureEstimateSnapshotForAcceptedEstimate({
    requestOrigin: input.requestOrigin,
    orgId: input.orgId,
    userId: input.userId,
    estimateId: input.estimateId,
    acceptedPublicVersionId: input.publicVersionId,
    reason: 'accepted',
  })
}

export async function repairAcceptedEstimateSnapshotForJob(
  input: {
    requestOrigin: string
    orgId: string
    userId: string
    jobId: string
  },
  deps?: RepairSnapshotDeps
): Promise<ServiceResult<CanonicalAcceptedEstimateSource>> {
  const db =
    deps?.db ??
    ((await import('../org.ts')).supabaseAdmin as unknown as DbReadChain)
  const operationalRecord = await loadAcceptedEstimateOperationalRecord(
    db,
    input.orgId,
    input.jobId
  )
  if (!operationalRecord.ok) return forwardServiceError(operationalRecord)

  const existingSnapshot = await loadAcceptedEstimateSnapshotRow(
    db,
    input.orgId,
    operationalRecord.data.operationalEstimateId
  )
  if (existingSnapshot.error) {
    return errorResult(
      'server_error',
      existingSnapshot.error.message ?? 'Unable to load accepted estimate snapshot'
    )
  }
  if (
    existingSnapshot.data &&
    !hasAcceptedEstimateSnapshotOwnership({
      snapshot: existingSnapshot.data as Unsafe,
      jobId: input.jobId,
      operationalEstimateId: operationalRecord.data.operationalEstimateId,
    })
  ) {
    return errorResult('invalid_input', 'Accepted estimate snapshot is invalid')
  }
  if (existingSnapshot.data) {
    const artifactState = readAcceptedEstimateSnapshotArtifactState(
      existingSnapshot.data as Unsafe
    )
    if (artifactState.kind === 'canonical') {
      return okResult(
        buildAcceptedEstimateSourceFromSnapshot({
          estimate: operationalRecord.data.estimate,
          snapshot: existingSnapshot.data,
          artifactState,
        })
      )
    }

    return buildAcceptedEstimateSnapshotRepairFailure(artifactState)
  }

  const ensureSnapshot = deps?.ensureSnapshot ?? ensureAcceptedEstimateOperationalSnapshot
  const repaired = await ensureSnapshot({
    requestOrigin: input.requestOrigin,
    orgId: input.orgId,
    userId: input.userId,
    estimateId: operationalRecord.data.operationalEstimateId,
    publicVersionId: operationalRecord.data.publicVersionId,
  })
  if (!repaired.ok) return forwardServiceError(repaired)

  const refreshed = await loadAcceptedEstimateSource(db, input.orgId, input.jobId)
  if (!refreshed.ok) return refreshed
  if (!refreshed.data.estimate_snapshot_id) {
    return errorResult(
      'server_error',
      'Accepted estimate snapshot repair did not create a usable snapshot.'
    )
  }

  return refreshed
}

export async function loadAcceptedEstimateSource(
  db: DbReadChain,
  orgId: string,
  jobId: string
): Promise<ServiceResult<CanonicalAcceptedEstimateSource>> {
  const operationalRecord = await loadAcceptedEstimateOperationalRecord(
    db,
    orgId,
    jobId
  )
  if (!operationalRecord.ok) return forwardServiceError(operationalRecord)

  const snapshotResult = await loadAcceptedEstimateSnapshotRow(
    db,
    orgId,
    operationalRecord.data.operationalEstimateId
  )

  if (snapshotResult.error) {
    return errorResult(
      'server_error',
      snapshotResult.error.message ?? 'Unable to load accepted estimate snapshot'
    )
  }
  if (!snapshotResult.data) {
    return errorResult(
      'invalid_input',
      'Accepted estimate snapshot is missing. Repair the snapshot before loading accepted estimate data.'
    )
  }
  if (
    !hasAcceptedEstimateSnapshotOwnership({
      snapshot: snapshotResult.data as Unsafe,
      jobId,
      operationalEstimateId: operationalRecord.data.operationalEstimateId,
    })
  ) {
    return errorResult('invalid_input', 'Accepted estimate snapshot is invalid')
  }

  const artifactState = readAcceptedEstimateSnapshotArtifactState(snapshotResult.data as Unsafe)
  if (artifactState.kind !== 'canonical') {
    return buildAcceptedEstimateSnapshotReadFailure(artifactState)
  }

  return okResult(
    buildAcceptedEstimateSourceFromSnapshot({
      estimate: operationalRecord.data.estimate,
      snapshot: snapshotResult.data,
      artifactState,
    })
  )
}
