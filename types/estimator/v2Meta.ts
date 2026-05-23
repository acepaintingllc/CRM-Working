// Estimate and job identity types — API-level metadata and utility primitives

export type UnsafeRecord = Record<string, unknown>

export type EstimateV2EstimateMeta = {
  id: string
  org_id?: string | null
  job_id: string
  version_name: string | null
  version_state: string | null
  version_kind?: string | null
  updated_at?: string | null
}

export type EstimateV2JobMeta = {
  id: string
  title: string
  status: string | null
  customer_id: string | null
  customer_name: string | null
  customer_address: string | null
  customer_email: string | null
  customer_phone: string | null
}

export type EstimateV2JobResponse = {
  job: EstimateV2JobMeta
}
