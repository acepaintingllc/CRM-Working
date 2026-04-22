import type { JobSummary } from '@/lib/jobs/client'
import type {
  QuoteHomeData,
  QuoteHomeEstimate,
} from '@/lib/quotes/collectionData'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'

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

export type SearchResultVm = {
  id: string
  href: string
  title: string
  meta: string
}

export type QuotesHomeHeaderVm = {
  heroSummaryText: string
  searchFocused: boolean
  searchQuery: string
  searchResults: SearchResultVm[]
}

export type QuoteHomeJobListItemVm = {
  id: string
  title: string
  customerName: string
  versionCountLabel: string
  href?: string
  isSelected?: boolean
}

export type QuotesHomeJobListVm = {
  loading: boolean
  searchQuery: string
  selectedJobId: string
  items: QuoteHomeJobListItemVm[]
  mobileItems: QuoteHomeJobListItemVm[]
  emptyState: 'none' | 'no_jobs' | 'no_matches'
}

export type QuotesHomeSelectedJobStatVm = {
  label: string
  value: string
}

export type QuotesHomeSelectedJobVm = {
  loading: boolean
  emptyMessage: string | null
  title: string | null
  customerLine: string | null
  jobHref: string | null
  stats: QuotesHomeSelectedJobStatVm[]
}

export type QuoteHomeVersionItemVm = {
  id: string
  title: string
  total: string | null
  meta: string
  href: string
  deleting: boolean
}

export type QuotesHomeVersionListVm = {
  heading: string
  emptyMessage: string | null
  items: QuoteHomeVersionItemVm[]
}

export type QuotesHomeCreateVm = {
  creating: boolean
  loading: boolean
  selectedJobName: string | null
  versionKind: QuoteVersionKind
  versionName: string
  canCreate: boolean
}

export type QuotesHomeDeleteDialogVm = {
  estimateId: string | null
  versionName: string | null
  jobTitle: string | null
  deleting: boolean
}
