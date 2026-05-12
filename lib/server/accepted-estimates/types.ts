import type { EstimatePublicPersistedSnapshot } from '@/lib/customer-estimates/publicSnapshot'
import type {
  CustomerSendOperationalEstimateResponse,
  EstimateCustomerSendInputs,
} from '@/lib/server/customer-send/contextTypes'

export const ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_KIND =
  'accepted_estimate_operational_snapshot_source' as const
export const ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_VERSION = 1 as const

export type AcceptedEstimateSourcePublicVersion = Record<string, unknown> & {
  id?: unknown
  version_number: unknown
  public_token: unknown
  accepted_at: unknown
  acceptance_json: unknown
  snapshot_json?: EstimatePublicPersistedSnapshot
}

export type AcceptedEstimateOperationalSourcePricing = {
  pricing_summary: CustomerSendOperationalEstimateResponse['pricing_summary'] | Record<string, unknown>
  final_total: number
  wall_calculations: CustomerSendOperationalEstimateResponse['wall_calculations'] | Record<string, unknown>
  ceiling_calculations: CustomerSendOperationalEstimateResponse['ceiling_calculations'] | Record<string, unknown>
  trim_calculations: CustomerSendOperationalEstimateResponse['trim_calculations'] | Record<string, unknown>
  door_calculations: CustomerSendOperationalEstimateResponse['door_calculations'] | Record<string, unknown>
  drywall_calculations: CustomerSendOperationalEstimateResponse['drywall_calculations'] | Record<string, unknown>
  trim_paint?: unknown
}

export type AcceptedEstimateAccessFeeRow = {
  id?: string | null
  room_id?: string | null
  access_fee_id?: string | null
  label?: string | null
  display_name?: string | null
  access_group?: string | null
  qty?: number | null
  catalog_amount?: number | null
  amount?: number | null
  actual_cost_override?: number | null
  calculated_total?: number | null
  effective_total?: number | null
  final_total?: number | null
  override_total?: number | null
  overridden?: boolean | null
  notes?: string | null
  position?: number | null
  [key: string]: unknown
}

export type AcceptedEstimateOperationalSource = {
  rooms: EstimateCustomerSendInputs['rooms']
  room_wall_scopes: EstimateCustomerSendInputs['room_wall_scopes']
  room_ceiling_scopes: EstimateCustomerSendInputs['room_ceiling_scopes']
  room_trim_scopes: EstimateCustomerSendInputs['room_trim_scopes']
  room_door_scopes: EstimateCustomerSendInputs['room_door_scopes']
  drywall_repairs: NonNullable<EstimateCustomerSendInputs['drywall_repairs']>
  access_fees: AcceptedEstimateAccessFeeRow[]
  prejob: EstimateCustomerSendInputs['prejob']
  pricing_summary: CustomerSendOperationalEstimateResponse['pricing_summary']
  final_total: number
  wall_calculations: CustomerSendOperationalEstimateResponse['wall_calculations']
  ceiling_calculations: CustomerSendOperationalEstimateResponse['ceiling_calculations']
  trim_calculations: CustomerSendOperationalEstimateResponse['trim_calculations']
  door_calculations: CustomerSendOperationalEstimateResponse['door_calculations']
  drywall_calculations: CustomerSendOperationalEstimateResponse['drywall_calculations']
}

export type AcceptedEstimateInternalOperationalEstimate = {
  inputs: EstimateCustomerSendInputs
  pricing: AcceptedEstimateOperationalSourcePricing
}

export type AcceptedEstimateOperationalSourcePayload = {
  artifact_kind: typeof ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_KIND
  artifact_version: typeof ACCEPTED_ESTIMATE_OPERATIONAL_SOURCE_VERSION
  estimate?: Record<string, unknown>
  job?: Record<string, unknown>
  accepted_public_version: AcceptedEstimateSourcePublicVersion
  customer_artifact: EstimatePublicPersistedSnapshot
  customer_visible_source?: 'customer_artifact.document'
  internal_operational_estimate: AcceptedEstimateInternalOperationalEstimate
}

type AcceptedEstimateSourceBase = {
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
  estimated_access_cost: number
  estimated_other_cost: number
  final_total: number
  snapshot_json: Record<string, unknown>
}

export type AcceptedEstimateSource = AcceptedEstimateSourceBase & {
  source_payload_json: AcceptedEstimateOperationalSourcePayload
  operational_source: AcceptedEstimateOperationalSource
}

export type CanonicalAcceptedEstimateSource = AcceptedEstimateSource

export type AcceptedEstimateRepairSource = AcceptedEstimateSourceBase & {
  source_payload_json: Record<string, unknown>
  operational_source?: null
}

export type AcceptedEstimateSnapshotArtifactState =
  | {
      kind: 'canonical'
      artifact: EstimatePublicPersistedSnapshot
      source_payload: AcceptedEstimateOperationalSourcePayload
      operational_source: AcceptedEstimateOperationalSource
      accepted_public_version: AcceptedEstimateSourcePublicVersion
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
