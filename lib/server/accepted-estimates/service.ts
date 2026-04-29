import type {
  AcceptedEstimateSource,
  AcceptEstimateOperationalInput,
} from './types.ts'
import { errorResult, okResult, type ServiceResult } from '../serviceResult.ts'

type Unsafe = Record<string, unknown>

type DbUpdateChain = {
  from(table: string): {
    update(payload: Record<string, unknown>): {
      eq(column: string, value: unknown): {
        eq(
          column: string,
          value: unknown
        ): Promise<{ error: { message?: string } | null }>
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

  return {
    org_id: asText(params.estimate.org_id),
    job_id: asText(params.estimate.job_id),
    estimate_id: asText(params.estimate.id),
    customer_id: asText(params.estimate.customer_id) || null,
    accepted_public_version_id: asText(params.estimate.accepted_public_version_id),
    accepted_at: asText(params.estimate.accepted_at),
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

  const estimateUpdate = await db
    .from('estimates')
    .update(plan.estimateUpdate)
    .eq('org_id', input.orgId)
    .eq('id', input.estimateId)

  if (estimateUpdate.error) {
    return errorResult(
      'server_error',
      estimateUpdate.error.message ?? 'Unable to mark estimate accepted'
    )
  }

  const jobUpdate = await db
    .from('jobs')
    .update(plan.jobUpdate)
    .eq('org_id', input.orgId)
    .eq('id', input.jobId)

  if (jobUpdate.error) {
    return errorResult(
      'server_error',
      jobUpdate.error.message ?? 'Unable to link accepted estimate to job'
    )
  }

  return okResult({ ok: true })
}
