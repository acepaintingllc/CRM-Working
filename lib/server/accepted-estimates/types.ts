export type AcceptedEstimateSource = {
  org_id: string
  job_id: string
  estimate_id: string
  customer_id: string | null
  accepted_public_version_id: string
  accepted_at: string
  version_name: string | null
  version_state: string | null
  final_total: number
  snapshot_json: Record<string, unknown>
}

export type AcceptEstimateOperationalInput = {
  orgId: string
  jobId: string
  estimateId: string
  publicVersionId: string
  acceptedAt: string
}
