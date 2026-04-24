import type {
  QuoteHomeJobListItemReadModel,
  QuoteHomeJobVersionItemReadModel,
  QuoteHomeSearchResultReadModel,
} from '@/lib/quotes/collectionData'
import type { QuoteVersionKind } from '@/lib/quotes/versionCreation'

export type QuoteHomeJob = QuoteHomeJobListItemReadModel
export type QuoteHomeJobVersion = QuoteHomeJobVersionItemReadModel
export type QuoteHomeSearchResult = Pick<
  QuoteHomeSearchResultReadModel,
  'estimate_id' | 'version_name' | 'version_state' | 'job_title' | 'customer_name'
>

export type NavItem = {
  label: string
  href?: string
  disabled?: boolean
}

export type SummaryCardVm = {
  label: string
  value: string
  displayValue: string
  subtext: string
  valueColor: string
  subtextColor: string
}

export type SearchResultVm = {
  id: string
  href: string
  title: string
  meta: string
}

export type QuoteHomeFeedbackTone = 'warning' | 'error'

export type QuoteHomeFailureSource =
  | 'bootstrap'
  | 'jobs'
  | 'jobVersions'
  | 'create'
  | 'delete'

export type QuoteHomeActionWarning = {
  source: QuoteHomeFailureSource
  message: string
}

export type QuoteHomeFeedbackVm = {
  tone: QuoteHomeFeedbackTone
  title: string
  details: string[]
  sources: QuoteHomeFailureSource[]
}

export type QuotesHomeFeedbackBannerVm = QuoteHomeFeedbackVm | null

export type QuotesHomeHeaderVm = {
  heroSummaryText: string
  searchFocused: boolean
  searchQuery: string
  searchLoading: boolean
  searchEmptyMessage: string | null
  searchErrorMessage: string | null
  searchCanRetry: boolean
  searchResults: SearchResultVm[]
}

export type QuoteHomeJobListItemVm = {
  id: string
  title: string
  customerName: string
  versionCountLabel: string
  isSelected?: boolean
}

export type QuotesHomeJobListVm = {
  loading: boolean
  searchQuery: string
  selectedJobId: string
  hasMore: boolean
  items: QuoteHomeJobListItemVm[]
  errorMessage: string | null
  canRetry: boolean
  emptyState: 'none' | 'no_jobs' | 'no_matches'
  emptyStateBody: string | null
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
  detail: string | null
  emptyMessage: string | null
  items: QuoteHomeVersionItemVm[]
  hasMore: boolean
  loadingMore: boolean
  errorMessage: string | null
  canRetry: boolean
}

export type QuotesHomeCreateVm = {
  eyebrow: string
  title: string
  description: string
  createButtonLabel: string
  versionNameLabel: string
  versionNameHelp: string
  versionNamePlaceholder: string
  versionKindLabel: string
  versionKindOptions: ReadonlyArray<{
    value: QuoteVersionKind
    label: string
  }>
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
