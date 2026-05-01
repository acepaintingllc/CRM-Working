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

type DbReadChain = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          maybeSingle(): DbMaybeSingleResponse
        }
      }
    }
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

export function buildAcceptedEstimateUpdatePlan(input: AcceptEstimateOperationalInput) {
  return {
    estimateUpdate: {
      accepted_at: input.acceptedAt,
      accepted_public_version_id: input.publicVersionId,
      version_state: 'live',
    },
    jobUpdate: {
      linked_estimate_id: input.estimateId,
      status: 'scheduled',
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
    final_total: asNumber(params.rollup?.final_total),
    snapshot_json: isRecord(snapshotJson) ? snapshotJson : {},
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

export async function loadAcceptedEstimateSource(
  db: DbReadChain,
  orgId: string,
  jobId: string
): Promise<ServiceResult<AcceptedEstimateSource>> {
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

  const linkedEstimateId = asText(jobResult.data.linked_estimate_id)
  if (!linkedEstimateId) {
    return errorResult('invalid_input', 'Job has no accepted estimate')
  }

  const estimateResult = await db
    .from('estimates')
    .select(
      'id, org_id, job_id, customer_id, version_name, version_state, accepted_at, accepted_public_version_id'
    )
    .eq('org_id', orgId)
    .eq('id', linkedEstimateId)
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
    return errorResult('invalid_input', 'Linked estimate does not belong to job')
  }

  const acceptedAt = asText(estimateResult.data.accepted_at)
  const publicVersionId = asText(estimateResult.data.accepted_public_version_id)
  if (!acceptedAt || !publicVersionId) {
    return errorResult('invalid_input', 'Linked estimate is not accepted')
  }

  const publicVersionResult = await db
    .from('estimate_public_versions')
    .select(
      'id, estimate_id, version_number, public_token, status, accepted_at, acceptance_json, snapshot_json'
    )
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
    asText(publicVersionResult.data.estimate_id) !== linkedEstimateId ||
    asText(publicVersionResult.data.status) !== 'accepted' ||
    !asText(publicVersionResult.data.accepted_at)
  ) {
    return errorResult('invalid_input', 'Accepted public version is invalid')
  }

  const rollupResult = await db
    .from('estimate_version_rollups')
    .select('final_total')
    .eq('org_id', orgId)
    .eq('estimate_id', linkedEstimateId)
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
