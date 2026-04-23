import type {
  QuoteHomeSummaryReadModel,
} from '@/lib/quotes/collectionData'
import type {
  QuoteHomeFeedbackVm,
  NavItem,
  QuoteHomeJob,
  QuoteHomeJobVersion,
  QuoteHomeJobListItemVm,
  QuoteHomeFailureSource,
  QuoteHomeVersionItemVm,
  QuotesHomeDeleteDialogVm,
  QuotesHomeSelectedJobVm,
  SearchResultVm,
  SummaryCardVm,
} from './quoteHomeTypes'

export const SETTINGS_LINKS: NavItem[] = [
  { label: 'Defaults', href: '/crm/quotes/defaults' },
  { label: 'Products', href: '/crm/quotes/products' },
  { label: 'Rates & Flags', href: '/crm/quotes/rates' },
  { label: 'Settings', href: '/crm/settings' },
]

export const QUOTE_META_SEPARATOR = ' · '

const HOME_FAILURE_MESSAGES: Record<'bootstrap', string> = {
  bootstrap: 'Quote home failed to load.',
}

const FAILURE_SOURCE_LABELS: Record<QuoteHomeFailureSource, string> = {
  bootstrap: 'bootstrap',
  jobVersions: 'job versions',
  create: 'quote creation',
  delete: 'quote deletion',
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

export function buildSearchResultVm(estimate: QuoteHomeJobVersion): SearchResultVm {
  return {
    id: estimate.estimate_id,
    href: estimateWorkspaceHref(estimate.estimate_id),
    title: estimate.version_name,
    meta: `${estimate.job_title}\n${estimate.customer_name} / ${formatVersionState(estimate.version_state)}`,
  }
}

export function buildHomeLoadFailureDetail(source: 'bootstrap', message: string) {
  const fallback = HOME_FAILURE_MESSAGES[source]
  return message === fallback ? message : `${fallback} ${message}`
}

export function buildQuotesHomeFeedbackVm(params: {
  homeFailures: Array<{ source: 'bootstrap'; message: string }>
  jobVersionsError: string | null
  createError: string | null
  deleteError: string | null
  actionWarning: string | null
}): QuoteHomeFeedbackVm | null {
  const details = params.homeFailures.map((failure) =>
    buildHomeLoadFailureDetail(failure.source, failure.message)
  )
  const sources = params.homeFailures.map((failure) => failure.source as QuoteHomeFailureSource)

  if (params.jobVersionsError) {
    details.push(
      params.jobVersionsError === 'Failed to load job quote versions.'
        ? 'Job versions failed to load.'
        : `Job versions failed to load. ${params.jobVersionsError}`
    )
    sources.push('jobVersions')
  }

  if (params.createError) {
    details.push(params.createError)
    sources.push('create')
  }

  if (params.deleteError) {
    details.push(params.deleteError)
    sources.push('delete')
  }

  if (params.actionWarning) {
    details.push(params.actionWarning)
    sources.push('delete')
  }

  if (details.length === 0) return null

  const actionError = Boolean(params.createError || params.deleteError)
  const actionWarning = Boolean(params.actionWarning)
  const title =
    actionError
      ? 'Quote action failed'
      : actionWarning
        ? 'Quote action completed with refresh errors'
      : params.jobVersionsError
        ? 'Quote home loaded with errors'
        : params.homeFailures.length > 1
          ? 'Some quote home data failed to load'
          : `Quote home ${FAILURE_SOURCE_LABELS[sources[0]]} failed to load`

  return {
    tone: actionError ? 'error' : 'warning',
    title,
    details,
    sources,
  }
}

export function buildHeroSummaryText(summary: QuoteHomeSummaryReadModel | null) {
  return summary
    ? `${summary.total_versions} total versions${QUOTE_META_SEPARATOR}${summary.draft_count} drafts${QUOTE_META_SEPARATOR}${summary.sent_or_awaiting_count} sent/awaiting${QUOTE_META_SEPARATOR}${summary.live_count} live`
    : 'Build and track quote versions with live status, totals, and search.'
}

export function buildQuoteHomeJobListItemVm(
  job: QuoteHomeJob,
  versionCount: number,
  options?: { mobile?: boolean; selectedJobId?: string }
): QuoteHomeJobListItemVm {
  return {
    id: job.id,
    title: job.title,
    customerName: job.customer_name ?? 'Unknown customer',
    versionCountLabel: `${versionCount} version${versionCount === 1 ? '' : 's'}`,
    href: options?.mobile ? `/crm/quotes/create?job=${job.id}` : undefined,
    isSelected: options?.selectedJobId === job.id,
  }
}

export function buildQuotesHomeSelectedJobVm(
  selectedJob: QuoteHomeJob | null,
  selectedJobVersionsCount: number,
  loading: boolean
): QuotesHomeSelectedJobVm {
  if (!selectedJob) {
    return {
      loading,
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
    emptyMessage: null,
    title: selectedJob.title,
    customerLine: `${selectedJob.customer_name ?? 'Unknown customer'}${
      selectedJob.customer_address ? `${QUOTE_META_SEPARATOR}${selectedJob.customer_address}` : ''
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
  deletingId: string | null
): QuoteHomeVersionItemVm {
  return {
    id: estimate.estimate_id,
    title: estimate.version_name || 'Quote Version',
    total:
      estimate.final_total != null && estimate.final_total > 0
        ? formatCurrency(estimate.final_total)
        : null,
    meta: `${formatVersionState(estimate.version_state)} / ${formatVersionState(
      estimate.version_kind
    )}${QUOTE_META_SEPARATOR}Updated ${formatDateTime(estimate.updated_at)}`,
    href: estimateWorkspaceHref(estimate.estimate_id),
    deleting: deletingId === estimate.estimate_id,
  }
}

export function buildQuotesHomeVersionHeading(
  selectedJob: QuoteHomeJob | null,
  versions: QuoteHomeJobVersion[]
) {
  return selectedJob
    ? `${versions.length} version${versions.length === 1 ? '' : 's'} under this job`
    : 'Pick a job first'
}

export function buildQuotesHomeVersionEmptyMessage(
  selectedJob: QuoteHomeJob | null,
  versions: QuoteHomeJobVersion[]
) {
  if (!selectedJob) return 'Versions will appear here once a job is selected.'
  if (versions.length === 0) {
    return 'No quote versions exist under this job yet. Use the panel on the right to create the first one.'
  }
  return null
}

export function buildQuotesHomeDeleteDialogVm(
  estimate: QuoteHomeJobVersion | null,
  deletingId: string | null
): QuotesHomeDeleteDialogVm {
  return {
    estimateId: estimate?.estimate_id ?? null,
    versionName: estimate?.version_name ?? null,
    jobTitle: estimate?.job_title ?? null,
    deleting: Boolean(deletingId),
  }
}

export function buildSummaryCards(summary: QuoteHomeSummaryReadModel | null): SummaryCardVm[] {
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
      subtext:
        nextSummary.draft_count === 1
          ? '1 draft version'
          : `${nextSummary.draft_count} draft versions`,
    },
    {
      label: 'Sent / Awaiting',
      value: String(nextSummary.sent_or_awaiting_count),
      subtext:
        nextSummary.sent_or_awaiting_count === 1
          ? '1 version attached to sent jobs'
          : `${nextSummary.sent_or_awaiting_count} versions attached to sent jobs`,
    },
    {
      label: 'Live Versions',
      value: String(nextSummary.live_count),
      subtext:
        nextSummary.live_count === 1 ? '1 live version' : `${nextSummary.live_count} live versions`,
      valueColor: 'var(--v2-green-2)',
      subtextColor: 'var(--v2-green-2)',
    },
    {
      label: 'Pipeline',
      value: formatCurrency(nextSummary.pipeline_total),
      subtext: 'Rollup-backed total',
      valueColor: '#f9e2b7',
      subtextColor: 'var(--v2-ink-3)',
    },
  ]
}
