import type { JobSummary } from '@/lib/jobs/client'
import type {
  QuoteHomeData,
  QuoteHomeEstimate,
} from '@/lib/quotes/collectionData'

export type HomeEstimate = QuoteHomeEstimate
export type HomeData = QuoteHomeData

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
