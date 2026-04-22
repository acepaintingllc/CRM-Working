import type { JobSummary } from '@/lib/jobs/client'

export type HomeEstimate = {
  estimate_id: string
  job_id: string
  customer_id: string
  version_name: string
  version_state: string
  version_kind: string
  version_sort_order: number
  job_title: string
  customer_name: string
  final_total: number | null
  updated_at: string | null
  created_at: string | null
  is_sent_estimate: boolean
}

export type HomeData = {
  summary: {
    draft_count: number
    sent_or_awaiting_count: number
    live_count: number
    pipeline_total: number
  }
  recent_estimates: HomeEstimate[]
  snapshot: (HomeEstimate & { total_versions: number }) | null
  search_estimates: HomeEstimate[]
}

export type QuoteHomeJob = JobSummary

export type NavItem = {
  label: string
  href?: string
  disabled?: boolean
}

export type SummaryCardVm = {
  label: string
  value: string
  subtext: string
  valueColor?: string
  subtextColor?: string
}

