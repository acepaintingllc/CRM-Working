import type {
  AcceptedEstimateSource,
  AcceptEstimateOperationalInput,
} from './types.ts'

type Unsafe = Record<string, unknown>

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function asNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
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
    snapshot_json: (params.publicVersion.snapshot_json ?? {}) as Record<string, unknown>,
  }
}
