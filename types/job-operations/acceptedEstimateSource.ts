import type { EstimatePublicPersistedSnapshot } from '@/lib/customer-estimates/publicSnapshot'
import type {
  AcceptedEstimateInternalOperationalEstimate,
  AcceptedEstimateOperationalSource as CanonicalAcceptedEstimateOperationalSource,
  AcceptedEstimateSource,
} from '@/lib/server/accepted-estimates/types'
import type { CustomerSendOperationalPricingSummary } from '@/lib/server/customer-send/contextTypes'

export type AcceptedEstimateOperationalJob = {
  id: string
  title: string | null
  status: string | null
  customer_id: string | null
  linked_estimate_id: string | null
}

export type AcceptedEstimateOperationalCustomer = {
  id: string | null
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

export type AcceptedEstimateOperationalAcceptance = {
  accepted_at: string
  accepted_by_legal_name: string | null
  signature_type: string | null
  user_agent: string | null
  ip: string | null
  public_version_id: string
  public_version_number: number
  public_token: string | null
}

export type AcceptedEstimateOperationalEstimate = {
  id: string
  version_name: string | null
  version_state: string | null
  estimate_snapshot_id: string | null
}

export type AcceptedEstimateOperationalScopes = {
  walls: CanonicalAcceptedEstimateOperationalSource['room_wall_scopes']
  ceilings: CanonicalAcceptedEstimateOperationalSource['room_ceiling_scopes']
  trim: CanonicalAcceptedEstimateOperationalSource['room_trim_scopes']
  doors: CanonicalAcceptedEstimateOperationalSource['room_door_scopes']
  drywall: CanonicalAcceptedEstimateOperationalSource['drywall_repairs']
  accessFees: CanonicalAcceptedEstimateOperationalSource['access_fees']
  prejob: CanonicalAcceptedEstimateOperationalSource['prejob']
}

export type AcceptedEstimateOperationalProduct = {
  id: string | null
  label: string | null
  source: string
  scope_kind: keyof Pick<
    AcceptedEstimateOperationalScopes,
    'walls' | 'ceilings' | 'trim' | 'doors'
  >
  scope_id: string | null
  room_id: string | null
}

export type AcceptedEstimateOperationalMaterials = {
  estimated_paint_gallons: number
  estimated_supplies_cost: number
  estimated_access_cost: number
  estimated_other_cost: number
  pricing_summary: CustomerSendOperationalPricingSummary | Record<string, unknown>
  wall_calculations: CanonicalAcceptedEstimateOperationalSource['wall_calculations']
  ceiling_calculations: CanonicalAcceptedEstimateOperationalSource['ceiling_calculations']
  trim_calculations: CanonicalAcceptedEstimateOperationalSource['trim_calculations']
  door_calculations: CanonicalAcceptedEstimateOperationalSource['door_calculations']
  drywall_calculations: CanonicalAcceptedEstimateOperationalSource['drywall_calculations']
}

export type AcceptedEstimateOperationalTotals = {
  accepted_total: number
  final_total: number
  pricing_summary: CustomerSendOperationalPricingSummary | Record<string, unknown>
  estimated_labor_hours: number
  estimated_paint_gallons: number
  estimated_supplies_cost: number
  estimated_access_cost: number
  estimated_other_cost: number
}

export type AcceptedEstimateOperationalNote = {
  source: string
  scope_kind?: keyof AcceptedEstimateOperationalScopes
  scope_id?: string | null
  room_id?: string | null
  text: string
}

export type AcceptedEstimateOperationalSource = {
  job: AcceptedEstimateOperationalJob
  customer: AcceptedEstimateOperationalCustomer
  acceptance: AcceptedEstimateOperationalAcceptance
  estimate: AcceptedEstimateOperationalEstimate
  publicDocumentSnapshot: EstimatePublicPersistedSnapshot
  internalEstimateSnapshot: AcceptedEstimateInternalOperationalEstimate
  rooms: CanonicalAcceptedEstimateOperationalSource['rooms']
  scopes: AcceptedEstimateOperationalScopes
  products: AcceptedEstimateOperationalProduct[]
  materials: AcceptedEstimateOperationalMaterials
  totals: AcceptedEstimateOperationalTotals
  notes: AcceptedEstimateOperationalNote[]
  source: Pick<
    AcceptedEstimateSource,
    | 'org_id'
    | 'job_id'
    | 'customer_id'
    | 'estimate_id'
    | 'accepted_public_version_id'
    | 'estimate_snapshot_id'
  >
}
