export type EstimatePublicTimelineVersion = {
  id: string
  estimate_id: string | null
  version_number: number | null
  public_token: string | null
  status?: string | null
  accepted_at?: string | null
  declined_at?: string | null
}

export type EstimatePublicTimelineEventRow = {
  id: string
  estimate_public_version_id: string | null
  event_type: string | null
  actor_type: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
  created_by: string | null
}

export type EstimatePublicTimelineEvent = {
  id: string
  type: string
  title: string
  body: string
  created_at: string | null
  created_by: string | null
  link_path: string | null
  link_label: string | null
  source_estimate_id?: string | null
  source_public_version_id?: string | null
}
