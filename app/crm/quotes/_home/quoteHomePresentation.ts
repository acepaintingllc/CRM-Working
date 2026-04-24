import {
  normalizeQuoteHomeSearchQuery,
  type QuoteHomeSummaryReadModel,
} from '@/lib/quotes/collectionData'
import { QUOTE_VERSION_KIND_OPTIONS } from '@/lib/quotes/versionCreation'
import type {
  QuoteHomeActionWarning,
  QuoteHomeFeedbackVm,
  QuoteHomeJob,
  QuoteHomeJobVersion,
  QuoteHomeJobListItemVm,
  QuoteHomeFailureSource,
  QuoteHomeSearchResult,
  QuoteHomeVersionItemVm,
  QuotesHomeDeleteDialogVm,
  QuotesHomeSelectedJobVm,
  SearchResultVm,
  SummaryCardVm,
  NavItem,
  QuotesHomeCreateVm,
  QuotesHomeJobListVm,
  QuotesHomeSearchStatusVm,
  QuotesHomeVersionListVm,
} from './quoteHomeTypes'

export const QUOTE_META_SEPARATOR = ' \u00B7 '
export const QUOTES_HOME_JOB_LIST_NO_JOBS_BODY =
  'Quote creation starts from a job with a linked customer. Add the contact first, then create the job in the normal CRM flow.'
export const QUOTES_HOME_SUMMARY_LOADING_VALUE = '...'
export const QUOTES_HOME_SUMMARY_DEFAULT_VALUE_COLOR = 'var(--v2-ink)'
export const QUOTES_HOME_SUMMARY_DEFAULT_SUBTEXT_COLOR = 'var(--v2-ink-3)'
export const QUOTES_HOME_CREATE_PANEL_COPY = {
  eyebrow: 'Create Version',
  title: 'Add the next quote version',
  description:
    'Creates a new quote version linked to this job, then opens it in the workspace.',
  createButton: 'Create version',
  creatingButton: 'Creating version...',
  versionNameLabel: 'Version Name',
  versionNameHelp: 'Leave blank for the next default version name.',
  versionNamePlaceholder: 'Leave blank for the next default version name',
  versionKindLabel: 'Version Kind',
} as const

export const QUOTES_HOME_LOADING_COPY = {
  jobs: 'Loading jobs...',
  jobSearch: 'No jobs match this search.',
  jobRetry: 'Retry jobs',
  jobRetrying: 'Retrying jobs...',
  versionsRetry: 'Retry versions',
  versionsRetrying: 'Retrying versions...',
  versionsLoadMore: 'Load more versions',
  versionsLoadingMore: 'Loading more versions...',
  jobsLoadMore: 'Load more jobs',
  jobsLoadingMore: 'Loading more jobs...',
} as const

export const QUOTES_HOME_DELETE_COPY = {
  buttonLabel: 'Delete',
  deletingButtonLabel: 'Deleting...',
  closeLabel: 'Close delete confirmation',
  warning: 'This permanently deletes the quote version. This cannot be undone.',
  info:
    'The home page will refresh job counts and the selected job version list after delete.',
  cancelLabel: 'Cancel',
} as const

export const QUOTES_HOME_RECOVERY_COPY = {
  title: 'Something went wrong loading quotes',
  reloadLabel: 'Reload',
} as const

export function buildQuotesHomeCreateVm(params: {
  creating: boolean
  loading: boolean
  selectedJobName: string | null
  versionName: string
  versionKind: QuotesHomeCreateVm['versionKind']
  canCreate: boolean
}): QuotesHomeCreateVm {
  return {
    eyebrow: QUOTES_HOME_CREATE_PANEL_COPY.eyebrow,
    title: QUOTES_HOME_CREATE_PANEL_COPY.title,
    description: QUOTES_HOME_CREATE_PANEL_COPY.description,
    createButtonLabel: params.creating
      ? QUOTES_HOME_CREATE_PANEL_COPY.creatingButton
      : QUOTES_HOME_CREATE_PANEL_COPY.createButton,
    versionNameLabel: QUOTES_HOME_CREATE_PANEL_COPY.versionNameLabel,
    versionNameHelp: QUOTES_HOME_CREATE_PANEL_COPY.versionNameHelp,
    versionNamePlaceholder: QUOTES_HOME_CREATE_PANEL_COPY.versionNamePlaceholder,
    versionKindLabel: QUOTES_HOME_CREATE_PANEL_COPY.versionKindLabel,
    versionKindOptions: QUOTE_VERSION_KIND_OPTIONS,
    creating: params.creating,
    loading: params.loading,
    selectedJobName: params.selectedJobName,
    versionName: params.versionName,
    versionKind: params.versionKind,
    canCreate: params.canCreate,
    disabledReason: buildQuotesHomeCreateDisabledReason(params),
  }
}

function buildQuotesHomeCreateDisabledReason(params: {
  creating: boolean
  loading: boolean
  selectedJobName: string | null
  canCreate: boolean
}) {
  if (params.creating) return 'A quote version is already being created.'
  if (params.loading) return 'Quote home is still loading.'
  if (!params.selectedJobName) return 'Select a job before creating a quote version.'
  if (!params.canCreate) return 'Quote version creation is not available right now.'
  return null
}

export const SETTINGS_LINKS: NavItem[] = [
  { label: 'Defaults', href: '/crm/quotes/defaults' },
  { label: 'Products', href: '/crm/quotes/products' },
  { label: 'Rates & Flags', href: '/crm/quotes/rates' },
  { label: 'Settings', href: '/crm/settings' },
]

const HOME_FAILURE_MESSAGES: Record<
  Extract<QuoteHomeFailureSource, 'bootstrap' | 'jobs'>,
  string
> = {
  bootstrap: 'Quote home failed to load.',
  jobs: 'Quote home jobs failed to load.',
}

const QUOTE_HOME_JOB_VERSIONS_FAILURE_MESSAGE =
  'Job versions failed to load.'

const FAILURE_SOURCE_LABELS: Record<QuoteHomeFailureSource, string> = {
  bootstrap: 'bootstrap',
  jobs: 'jobs',
  jobVersions: 'job versions',
  create: 'quote creation',
  delete: 'quote deletion',
}

type QuoteHomeLoadFailure = {
  source: Extract<QuoteHomeFailureSource, 'bootstrap' | 'jobs'>
  message: string
}

export function formatVersionCount(value: number) {
  return `${value} version${value === 1 ? '' : 's'}`
}

export function formatToday() {
  const now = new Date()
  return now
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    .replace(',', ' /')
    .toUpperCase()
}

export function formatCurrency(value: number | null | undefined) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatVersionState(value: string | null | undefined) {
  return String(value ?? 'draft')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function estimateWorkspaceHref(estimateId: string) {
  return `/crm/quotes/${estimateId}`
}

export function buildSearchResultVm(
  estimate: QuoteHomeSearchResult,
): SearchResultVm {
  return {
    id: estimate.estimate_id,
    href: estimateWorkspaceHref(estimate.estimate_id),
    title: estimate.version_name,
    meta: `${estimate.job_title}\n${estimate.customer_name} / ${formatVersionState(estimate.version_state)}`,
  }
}

export function buildQuotesHomeSearchEmptyMessage(params: {
  query: string
  loading: boolean
  error: string | null
  resultCount: number
}) {
  if (!params.query || params.loading || params.error || params.resultCount > 0) {
    return null
  }

  return `No quote versions match "${params.query}".`
}

export function buildQuotesHomeSearchCanRetry(params: {
  query: string
  loading: boolean
}) {
  return Boolean(params.query) && !params.loading
}

export function buildQuotesHomeSearchStatus(params: {
  query: string
  loading: boolean
  error: string | null
  resultCount: number
}): QuotesHomeSearchStatusVm {
  const query = normalizeQuoteHomeSearchQuery(params.query)
  if (!query) return { kind: 'idle' }

  if (params.loading) {
    return {
      kind: 'loading',
      title: 'Searching quote versions',
      message: `Looking up versions that match "${query}".`,
    }
  }

  if (params.error) {
    return {
      kind: 'error',
      title: 'Search results failed to load',
      message: params.error,
      canRetry: buildQuotesHomeSearchCanRetry({
        query,
        loading: params.loading,
      }),
    }
  }

  if (params.resultCount === 0) {
    return {
      kind: 'empty',
      title: 'No matching quote versions',
      message: `No quote versions match "${query}".`,
    }
  }

  return { kind: 'results' }
}

export function buildQuotesHomeHeaderSearchStatus(params: {
  query: string
  loading: boolean
  errorMessage: string | null
  emptyMessage: string | null
  resultCount: number
  canRetry: boolean
}): QuotesHomeSearchStatusVm {
  const query = normalizeQuoteHomeSearchQuery(params.query)
  if (!query) return { kind: 'idle' }
  if (params.loading) {
    return {
      kind: 'loading',
      title: 'Searching quote versions',
      message: `Looking up versions that match "${query}".`,
    }
  }
  if (params.errorMessage) {
    return {
      kind: 'error',
      title: 'Search results failed to load',
      message: params.errorMessage,
      canRetry: params.canRetry,
    }
  }
  if (params.emptyMessage) {
    return {
      kind: 'empty',
      title: 'No matching quote versions',
      message: params.emptyMessage,
    }
  }
  return params.resultCount > 0 ? { kind: 'results' } : { kind: 'idle' }
}

export function buildHomeLoadFailureDetail(
  source: Extract<QuoteHomeFailureSource, 'bootstrap' | 'jobs'>,
  message: string,
) {
  const fallback = HOME_FAILURE_MESSAGES[source]
  if (!message) return fallback
  return message.startsWith(fallback) ? message : `${fallback} ${message}`
}

function buildJobVersionsFailureDetail(message: string) {
  if (message === 'Failed to load job quote versions.') {
    return QUOTE_HOME_JOB_VERSIONS_FAILURE_MESSAGE
  }

  return `${QUOTE_HOME_JOB_VERSIONS_FAILURE_MESSAGE} ${message}`
}

function appendFeedbackDetail(
  feedback: Pick<QuoteHomeFeedbackVm, 'details' | 'sources'>,
  source: QuoteHomeFailureSource,
  detail: string,
) {
  feedback.details.push(detail)
  feedback.sources.push(source)
}

function buildQuotesHomeFeedbackTitle(params: {
  homeFailureCount: number
  sources: QuoteHomeFailureSource[]
  hasJobVersionsError: boolean
  hasActionError: boolean
  hasActionWarning: boolean
}) {
  if (params.hasActionError) return 'Quote action failed'
  if (params.hasActionWarning) {
    return 'Quote action completed with refresh errors'
  }
  if (params.hasJobVersionsError) return 'Quote home loaded with errors'
  if (params.homeFailureCount > 1) {
    return 'Some quote home data failed to load'
  }

  return `Quote home ${FAILURE_SOURCE_LABELS[params.sources[0]]} failed to load`
}

export function buildQuotesHomeFeedbackVm(params: {
  homeFailures: QuoteHomeLoadFailure[]
  jobVersionsError: string | null
  createError: string | null
  deleteError: string | null
  actionWarning: QuoteHomeActionWarning | null
}): QuoteHomeFeedbackVm | null {
  const feedback: Pick<QuoteHomeFeedbackVm, 'details' | 'sources'> = {
    details: [],
    sources: [],
  }

  params.homeFailures.forEach((failure) => {
    appendFeedbackDetail(
      feedback,
      failure.source,
      buildHomeLoadFailureDetail(failure.source, failure.message),
    )
  })

  if (params.jobVersionsError) {
    appendFeedbackDetail(
      feedback,
      'jobVersions',
      buildJobVersionsFailureDetail(params.jobVersionsError),
    )
  }

  if (params.createError) {
    appendFeedbackDetail(feedback, 'create', params.createError)
  }

  if (params.deleteError) {
    appendFeedbackDetail(feedback, 'delete', params.deleteError)
  }

  if (params.actionWarning) {
    appendFeedbackDetail(
      feedback,
      params.actionWarning.source,
      params.actionWarning.message,
    )
  }

  if (feedback.details.length === 0) return null

  const actionError = Boolean(params.createError || params.deleteError)
  const actionWarning = Boolean(params.actionWarning)
  const title = buildQuotesHomeFeedbackTitle({
    homeFailureCount: params.homeFailures.length,
    sources: feedback.sources,
    hasJobVersionsError: Boolean(params.jobVersionsError),
    hasActionError: actionError,
    hasActionWarning: actionWarning,
  })

  return {
    tone: actionError ? 'error' : 'warning',
    title,
    details: feedback.details,
    sources: feedback.sources,
  }
}

export function buildHeroSummaryText(
  summary: QuoteHomeSummaryReadModel | null,
) {
  return summary
    ? `${summary.total_versions} total versions${QUOTE_META_SEPARATOR}${summary.draft_count} drafts${QUOTE_META_SEPARATOR}${summary.sent_or_awaiting_count} sent/awaiting${QUOTE_META_SEPARATOR}${summary.live_count} live`
    : 'Build and track quote versions with live status, totals, and search.'
}

export function buildQuoteHomeJobListItemVm(
  job: QuoteHomeJob,
  versionCount: number,
  options?: { selectedJobId?: string },
): QuoteHomeJobListItemVm {
  return {
    id: job.id,
    title: job.title,
    customerName: job.customer_name ?? 'Unknown customer',
    versionCountLabel: `${versionCount} version${versionCount === 1 ? '' : 's'}`,
    isSelected: options?.selectedJobId === job.id,
  }
}

export function buildQuotesHomeJobListEmptyState(params: {
  hasLoadError: boolean
  totalJobCount: number
  visibleJobCount: number
}): 'none' | 'no_jobs' | 'no_matches' {
  if (params.hasLoadError) return 'none'
  if (params.totalJobCount === 0) return 'no_jobs'
  if (params.visibleJobCount === 0) return 'no_matches'
  return 'none'
}

export function buildQuotesHomeJobListEmptyStateBody(
  emptyState: 'none' | 'no_jobs' | 'no_matches',
) {
  return emptyState === 'no_jobs' ? QUOTES_HOME_JOB_LIST_NO_JOBS_BODY : null
}

export function buildQuotesHomeJobListStatus(params: {
  loading: boolean
  errorMessage: string | null
  canRetry: boolean
  emptyState: QuotesHomeJobListVm['emptyState']
  emptyStateBody: string | null
}): QuotesHomeJobListVm['status'] {
  if (params.loading) {
    return {
      kind: 'loading',
      message: QUOTES_HOME_LOADING_COPY.jobs,
    }
  }

  if (params.errorMessage) {
    return {
      kind: 'error',
      title: 'Jobs failed to load',
      message: params.errorMessage,
      canRetry: params.canRetry,
      retryLabel: QUOTES_HOME_LOADING_COPY.jobRetry,
      retryingLabel: QUOTES_HOME_LOADING_COPY.jobRetrying,
    }
  }

  if (params.emptyState === 'no_jobs') {
    return {
      kind: 'empty',
      emptyState: 'no_jobs',
      title: 'No eligible jobs yet',
      body: params.emptyStateBody,
    }
  }

  if (params.emptyState === 'no_matches') {
    return {
      kind: 'empty',
      emptyState: 'no_matches',
      title: QUOTES_HOME_LOADING_COPY.jobSearch,
      body: null,
    }
  }

  return { kind: 'ready' }
}

export function buildQuotesHomeJobListStatusFromVm(
  vm: QuotesHomeJobListVm,
): NonNullable<QuotesHomeJobListVm['status']> {
  return buildQuotesHomeJobListStatus({
    loading: vm.loading,
    errorMessage: vm.errorMessage,
    canRetry: vm.canRetry,
    emptyState: vm.emptyState,
    emptyStateBody: vm.emptyStateBody,
  })
}

export function buildQuotesHomeSelectedJobVm(
  selectedJob: QuoteHomeJob | null,
  selectedJobVersionsCount: number,
  loading: boolean,
): QuotesHomeSelectedJobVm {
  if (!selectedJob) {
    return {
      loading,
      state: loading ? 'loading' : 'empty',
      emptyMessage: loading
        ? null
        : 'Select a job from the left to view versions and create the next one.',
      title: null,
      customerLine: null,
      jobHref: null,
      stats: [],
    }
  }

  return {
    loading,
    state: 'selected',
    emptyMessage: null,
    title: selectedJob.title,
    customerLine: `${selectedJob.customer_name ?? 'Unknown customer'}${
      selectedJob.customer_address
        ? `${QUOTE_META_SEPARATOR}${selectedJob.customer_address}`
        : ''
    }`,
    jobHref: `/crm/jobs/${selectedJob.id}`,
    stats: [
      { label: 'Customer', value: selectedJob.customer_name ?? 'Unknown' },
      { label: 'Job Status', value: formatVersionState(selectedJob.status) },
      { label: 'Versions', value: String(selectedJobVersionsCount) },
    ],
  }
}

export function buildQuoteHomeVersionItemVm(
  estimate: QuoteHomeJobVersion,
  deletingId: string | null,
): QuoteHomeVersionItemVm {
  const title = estimate.version_name || 'Quote Version'
  const isDeletingThisVersion = deletingId === estimate.estimate_id
  const hasDeleteInFlight = Boolean(deletingId)

  return {
    id: estimate.estimate_id,
    title,
    total:
      estimate.final_total != null && estimate.final_total > 0
        ? formatCurrency(estimate.final_total)
        : null,
    meta: `${formatVersionState(estimate.version_state)} / ${formatVersionState(
      estimate.version_kind,
    )}${QUOTE_META_SEPARATOR}Updated ${formatDateTime(estimate.updated_at)}`,
    href: estimateWorkspaceHref(estimate.estimate_id),
    deleting: isDeletingThisVersion,
    deleteDisabled: hasDeleteInFlight,
    deleteBusy: isDeletingThisVersion,
    deleteButtonLabel: isDeletingThisVersion
      ? QUOTES_HOME_DELETE_COPY.deletingButtonLabel
      : QUOTES_HOME_DELETE_COPY.buttonLabel,
    deleteButtonAriaLabel: buildQuoteHomeVersionDeleteAriaLabel({
      title,
      deleting: isDeletingThisVersion,
      disabledByAnotherDelete: hasDeleteInFlight && !isDeletingThisVersion,
    }),
  }
}

function buildQuoteHomeVersionDeleteAriaLabel(params: {
  title: string
  deleting: boolean
  disabledByAnotherDelete: boolean
}) {
  if (params.deleting) return `Deleting quote version ${params.title}`
  if (params.disabledByAnotherDelete) {
    return `Delete quote version ${params.title} unavailable while another version is deleting`
  }
  return `Delete quote version ${params.title}`
}

export function buildQuotesHomeVersionHeading(
  selectedJob: QuoteHomeJob | null,
  totalVersions: number,
) {
  return selectedJob
    ? `${formatVersionCount(totalVersions)} under this job`
    : 'Pick a job first'
}

export function buildQuotesHomeSelectedJobVersionCount(params: {
  selectedJob: QuoteHomeJob | null
  totalVersions: number
  hasResolved: boolean
}) {
  if (!params.selectedJob) return params.totalVersions
  return params.hasResolved
    ? params.totalVersions
    : params.selectedJob.version_count
}

export function buildQuotesHomeVersionDetail(
  selectedJob: QuoteHomeJob | null,
  params: {
    loadedVersions: number
    totalVersions: number
    hasMore: boolean
  },
) {
  if (!selectedJob || params.totalVersions === 0 || params.loadedVersions === 0) {
    return null
  }

  if (params.hasMore) {
    return `Showing ${params.loadedVersions} of ${formatVersionCount(params.totalVersions)}.`
  }

  if (params.loadedVersions !== params.totalVersions) {
    return `Showing ${params.loadedVersions} of ${formatVersionCount(params.totalVersions)} - reload to see all.`
  }

  return `Showing all ${formatVersionCount(params.totalVersions)}.`
}

export function buildQuotesHomeVersionEmptyMessage(
  selectedJob: QuoteHomeJob | null,
  versions: QuoteHomeJobVersion[],
) {
  if (!selectedJob) return 'Versions will appear here once a job is selected.'
  if (versions.length === 0) {
    return 'No quote versions exist under this job yet. Use the panel on the right to create the first one.'
  }
  return null
}

export function buildQuotesHomeVersionListStatus(params: {
  errorMessage: string | null
  canRetry: boolean
  emptyMessage: string | null
}): QuotesHomeVersionListVm['status'] {
  if (params.errorMessage) {
    return {
      kind: 'error',
      title: 'Versions failed to load',
      message: params.errorMessage,
      canRetry: params.canRetry,
      retryLabel: QUOTES_HOME_LOADING_COPY.versionsRetry,
      retryingLabel: QUOTES_HOME_LOADING_COPY.versionsRetrying,
    }
  }

  if (params.emptyMessage) {
    return {
      kind: 'empty',
      message: params.emptyMessage,
    }
  }

  return { kind: 'ready' }
}

export function buildQuotesHomeDeleteDialogVm(
  estimate: QuoteHomeJobVersion | null,
  deletingId: string | null,
): QuotesHomeDeleteDialogVm {
  const versionName = estimate?.version_name?.trim() || 'this quote version'
  const jobTitle = estimate?.job_title?.trim() || 'the selected job'
  const isDeletingThisVersion = Boolean(
    estimate?.estimate_id && deletingId === estimate.estimate_id,
  )
  const hasDeleteInFlight = Boolean(deletingId)

  return {
    isOpen: Boolean(estimate?.estimate_id),
    estimateId: estimate?.estimate_id ?? null,
    versionName: estimate?.version_name ?? null,
    jobTitle: estimate?.job_title ?? null,
    deleting: isDeletingThisVersion,
    title: `Delete ${versionName}?`,
    description: `Permanently delete quote version ${versionName} from ${jobTitle}.`,
    closeLabel: QUOTES_HOME_DELETE_COPY.closeLabel,
    warning: QUOTES_HOME_DELETE_COPY.warning,
    info: QUOTES_HOME_DELETE_COPY.info,
    cancelLabel: QUOTES_HOME_DELETE_COPY.cancelLabel,
    cancelAriaLabel: `Cancel deleting quote version ${versionName}`,
    confirmLabel: `Delete ${versionName}`,
    confirmAriaLabel: `Permanently delete quote version ${versionName} from ${jobTitle}`,
    confirmingLabel: `Deleting ${versionName}...`,
    confirmingAriaLabel: `Deleting quote version ${versionName} from ${jobTitle}`,
    confirmDisabled: hasDeleteInFlight,
    cancelDisabled: hasDeleteInFlight,
  }
}

export function buildSummaryCards(
  summary: QuoteHomeSummaryReadModel | null,
): SummaryCardVm[] {
  const nextSummary = summary ?? {
    draft_count: 0,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 0,
  }

  return [
    {
      label: 'Drafts',
      value: String(nextSummary.draft_count),
      displayValue: String(nextSummary.draft_count),
      subtext:
        nextSummary.draft_count === 1
          ? '1 draft version'
          : `${nextSummary.draft_count} draft versions`,
      valueColor: QUOTES_HOME_SUMMARY_DEFAULT_VALUE_COLOR,
      subtextColor: QUOTES_HOME_SUMMARY_DEFAULT_SUBTEXT_COLOR,
    },
    {
      label: 'Sent / Awaiting',
      value: String(nextSummary.sent_or_awaiting_count),
      displayValue: String(nextSummary.sent_or_awaiting_count),
      subtext:
        nextSummary.sent_or_awaiting_count === 1
          ? '1 version attached to sent jobs'
          : `${nextSummary.sent_or_awaiting_count} versions attached to sent jobs`,
      valueColor: QUOTES_HOME_SUMMARY_DEFAULT_VALUE_COLOR,
      subtextColor: QUOTES_HOME_SUMMARY_DEFAULT_SUBTEXT_COLOR,
    },
    {
      label: 'Live Versions',
      value: String(nextSummary.live_count),
      displayValue: String(nextSummary.live_count),
      subtext:
        nextSummary.live_count === 1
          ? '1 live version'
          : `${nextSummary.live_count} live versions`,
      valueColor: 'var(--v2-green-2)',
      subtextColor: 'var(--v2-green-2)',
    },
    {
      label: 'Pipeline',
      value: formatCurrency(nextSummary.pipeline_total),
      displayValue: formatCurrency(nextSummary.pipeline_total),
      subtext: 'Rollup-backed total',
      valueColor: 'var(--v2-amber)',
      subtextColor: 'var(--v2-ink-3)',
    },
  ]
}
