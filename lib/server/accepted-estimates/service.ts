import type {
  AcceptedEstimateSource,
  AcceptEstimateOperationalInput,
} from './types.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'
import { normalizeEstimatePublicAcceptanceRecord } from '../../customer-estimates/publicAcceptance.ts'

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

type AcceptedEstimateResolutionSource = 'job_link' | 'legacy_job_estimate_fallback'

type OperationalAcceptedEstimateResolution = {
  operationalEstimateId: string
  resolutionSource: AcceptedEstimateResolutionSource
}

const acceptedEstimateColumns =
  'id, org_id, job_id, customer_id, version_name, version_state, accepted_at, accepted_public_version_id'
const acceptedEstimateSnapshotColumns =
  'id, org_id, job_id, estimate_id, customer_id, accepted_public_version_id, estimate_version_name, estimate_version_state, estimated_labor_hours, estimated_paint_gallons, estimated_supplies_cost, estimated_other_cost, estimated_total, source_payload_json'
const acceptedPublicVersionColumns =
  'id, estimate_id, version_number, public_token, status, accepted_at, acceptance_json, snapshot_json'

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
  const snapshotJson = params.publicVersion.snapshot_json
  const acceptance = normalizeEstimatePublicAcceptanceRecord(params.publicVersion.acceptance_json)

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
    final_total: asNumber(params.rollup?.final_total),
    snapshot_json: isRecord(snapshotJson) ? snapshotJson : {},
  }
}

type RepairSnapshotDeps = {
  db?: DbReadChain
  ensureSnapshot?: typeof ensureAcceptedEstimateOperationalSnapshot
}

export function buildAcceptedEstimateSourceFromSnapshot(params: {
  estimate: Unsafe
  publicVersion?: Unsafe | null
  snapshot: Unsafe
}): AcceptedEstimateSource {
  const sourcePayload = params.snapshot.source_payload_json
  const sourcePublicVersion =
    isRecord(sourcePayload) && isRecord(sourcePayload.public_version)
      ? sourcePayload.public_version
      : null
  const publicVersion = params.publicVersion ?? sourcePublicVersion
  const sourceSnapshot =
    isRecord(sourcePayload) && isRecord(sourcePayload.customer_send_snapshot_json)
      ? sourcePayload.customer_send_snapshot_json
      : publicVersion?.snapshot_json
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
    final_total: asNumber(params.snapshot.estimated_total),
    snapshot_json: isRecord(sourceSnapshot) ? sourceSnapshot : {},
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
  const source = await loadAcceptedEstimateSource(db, input.orgId, input.jobId)
  if (!source.ok) return source
  if (source.data.estimate_snapshot_id) return source

  const ensureSnapshot = deps?.ensureSnapshot ?? ensureAcceptedEstimateOperationalSnapshot
  const repaired = await ensureSnapshot({
    requestOrigin: input.requestOrigin,
    orgId: input.orgId,
    userId: input.userId,
    estimateId: source.data.estimate_id,
    publicVersionId: source.data.accepted_public_version_id,
  })
  if (!repaired.ok) return repaired

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
  const acceptedEstimateResolution = await resolveOperationalAcceptedEstimateForJob(
    db,
    orgId,
    jobId
  )
  if (!acceptedEstimateResolution.ok) return acceptedEstimateResolution
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

  const snapshotResult = await db
    .from('estimate_snapshot')
    .select(acceptedEstimateSnapshotColumns)
    .eq('org_id', orgId)
    .eq('estimate_id', operationalEstimateId)
    .maybeSingle()

  if (snapshotResult.error) {
    return errorResult(
      'server_error',
      snapshotResult.error.message ?? 'Unable to load accepted estimate snapshot'
    )
  }

  if (snapshotResult.data) {
    if (
      asText(snapshotResult.data.job_id) !== jobId ||
      asText(snapshotResult.data.estimate_id) !== operationalEstimateId
    ) {
      return errorResult('invalid_input', 'Accepted estimate snapshot is invalid')
    }

    return okResult(
      buildAcceptedEstimateSourceFromSnapshot({
        estimate: estimateResult.data,
        snapshot: snapshotResult.data,
      })
    )
  }

  const publicVersionResult = await db
    .from('estimate_public_versions')
    .select(acceptedPublicVersionColumns)
    .eq('org_id', orgId)
    .eq('id', publicVersionId)
    .maybeSingle()

  if (publicVersionResult.error) {
    return errorResult(
      'server_error',
      publicVersionResult.error.message ?? 'Unable to load accepted public version'
    )
  }
  if (!publicVersionResult.data) {
    return errorResult('not_found', 'Accepted public version not found')
  }

  if (
    asText(publicVersionResult.data.estimate_id) !== operationalEstimateId ||
    asText(publicVersionResult.data.status) !== 'accepted' ||
    !asText(publicVersionResult.data.accepted_at)
  ) {
    return errorResult('invalid_input', 'Accepted public version is invalid')
  }

  const rollupResult = await db
    .from('estimate_version_rollups')
    .select('final_total')
    .eq('org_id', orgId)
    .eq('estimate_id', operationalEstimateId)
    .maybeSingle()

  if (rollupResult.error) {
    return errorResult(
      'server_error',
      rollupResult.error.message ?? 'Unable to load accepted estimate rollup'
    )
  }

  return okResult(
    buildAcceptedEstimateSource({
      estimate: estimateResult.data,
      publicVersion: publicVersionResult.data,
      rollup: rollupResult.data,
    })
  )
}
