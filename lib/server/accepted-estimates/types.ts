import type { EstimatePublicPersistedSnapshot } from '@/lib/customer-estimates/publicSnapshot'

export type AcceptedEstimateSource = {
  org_id: string
  job_id: string
  estimate_id: string
  customer_id: string | null
  accepted_public_version_id: string
  public_version_number: number
  public_token: string | null
  accepted_at: string
  accepted_by_legal_name: string | null
  signature_type: string | null
  user_agent: string | null
  ip: string | null
  version_name: string | null
  version_state: string | null
  estimate_snapshot_id: string | null
  estimated_labor_hours: number
  estimated_paint_gallons: number
  estimated_supplies_cost: number
  estimated_other_cost: number
  final_total: number
  snapshot_json: Record<string, unknown>
}

export type AcceptedEstimateSnapshotArtifactState =
  | {
      kind: 'canonical'
      artifact: EstimatePublicPersistedSnapshot
      accepted_public_version: Record<string, unknown>
    }
  | {
      kind: 'missing'
      message: string
    }
  | {
      kind: 'legacy'
      message: string
    }
  | {
      kind: 'invalid'
      message: string
    }

export type AcceptEstimateOperationalInput = {
  orgId: string
  jobId: string
  estimateId: string
  publicVersionId: string
  acceptedAt: string
}
