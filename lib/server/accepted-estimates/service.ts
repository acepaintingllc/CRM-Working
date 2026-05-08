import type {
  AcceptedEstimateSnapshotArtifactState,
  AcceptedEstimateSource,
  AcceptEstimateOperationalInput,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asNullableRecord(value: unknown) {
  return isRecord(value) ? value : null
}

type AcceptedEstimateResolutionSource = 'job_link' | 'legacy_job_estimate_fallback'

type OperationalAcceptedEstimateResolution = {
  operationalEstimateId: string
  resolutionSource: AcceptedEstimateResolutionSource
}

const acceptedEstimateColumns =
  'id, org_id, job_id, customer_id, version_name, version_state, accepted_at, accepted_public_version_id'
const acceptedEstimateSnapshotColumns =
  'id, org_id, job_id, estimate_id, customer_id, accepted_public_version_id, estimate_version_name, estimate_version_state, estimated_labor_hours, estimated_paint_gallons, estimated_supplies_cost, estimated_other_cost, estimated_total, source_payload_json'

function readAcceptedSnapshotPayload(snapshot: Unsafe) {
  return asNullableRecord(snapshot.source_payload_json)
}

function readAcceptedSnapshotEmbeddedAcceptedPublicVersion(snapshot: Unsafe) {
  return asNullableRecord(readAcceptedSnapshotPayload(snapshot)?.accepted_public_version)
}

function readAcceptedSnapshotEmbeddedCustomerArtifact(snapshot: Unsafe) {
  return asNullableRecord(readAcceptedSnapshotPayload(snapshot)?.customer_artifact)
}

function readAcceptedSnapshotLegacyEmbeddedPublicVersion(snapshot: Unsafe) {
  return asNullableRecord(readAcceptedSnapshotPayload(snapshot)?.public_version)
}

function readAcceptedSnapshotLegacyEmbeddedCustomerArtifact(snapshot: Unsafe) {
  return asNullableRecord(readAcceptedSnapshotPayload(snapshot)?.customer_send_snapshot_json)
}

function hasAcceptedSnapshotPublicVersionDetails(publicVersion: Record<string, unknown> | null) {
  if (!publicVersion) return false

  return (
    typeof publicVersion.version_number !== 'undefined' &&
    'public_token' in publicVersion &&
    Boolean(asText(publicVersion.accepted_at)) &&
    'acceptance_json' in publicVersion
  )
}

function readAcceptedEstimateSnapshotArtifactState(
  snapshot: Unsafe
): AcceptedEstimateSnapshotArtifactState {
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
  if (!hasAcceptedSnapshotPublicVersionDetails(acceptedPublicVersion)) {
    return {
      kind: 'legacy',
      message:
        'Accepted estimate snapshot payload is incomplete. Repair the snapshot before loading accepted estimate data.',
    }
  }

  return {
    kind: 'canonical',
    artifact: artifactState.snapshot,
    accepted_public_version: acceptedPublicVersion as Record<string, unknown>,
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
}): AcceptedEstimateSource {
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
    estimated_other_cost: 0,
    final_total: customerVisibleTotal,
    snapshot_json: snapshotJson ?? {},
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
}): AcceptedEstimateSource {
  const publicVersion = params.artifactState.accepted_public_version
  const acceptance = normalizeEstimatePublicAcceptanceRecord(publicVersion?.acceptance_json)

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
    estimated_other_cost: asNumber(params.snapshot.estimated_other_cost),
    final_total: readAcceptedCustomerVisibleTotal(params.artifactState),
    snapshot_json: params.artifactState.artifact as Record<string, unknown>,
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
): Promise<ServiceResult<AcceptedEstimateSource>> {
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
): Promise<ServiceResult<AcceptedEstimateSource>> {
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
