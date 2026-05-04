export type TrendRecommendationConfidence = 'low' | 'medium' | 'high'
export type TrendRecommendationStatus = 'open' | 'dismissed' | 'applied' | 'stale'
export type TrendRecommendationStatusUpdate = Exclude<
  TrendRecommendationStatus,
  'applied'
>

export type TrendRecommendationRecord = {
  id: string
  org_id: string
  target_setting_key: string
  current_value_json: Record<string, unknown>
  suggested_value_json: Record<string, unknown>
  reason: string
  evidence_json: Record<string, unknown>
  evidence_hash: string
  confidence_label: TrendRecommendationConfidence
  based_on_job_count: number
  status: TrendRecommendationStatus
  applied_setting_set_id: string | null
  created_at: string
  updated_at: string
  applied_at: string | null
  dismissed_at: string | null
}
