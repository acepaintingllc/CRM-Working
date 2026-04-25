import { QUOTES_HOME_DELETE_COPY } from './quoteHomeDeletePresentation'
import type {
  QuoteHomeJob,
  QuoteHomeJobVersion,
  QuoteHomeVersionItemVm,
  QuotesHomeVersionListVm,
} from './quoteHomeTypes'
import {
  estimateWorkspaceHref,
  formatCurrency,
  formatDateTime,
  formatVersionCount,
  formatVersionState,
  QUOTE_META_SEPARATOR,
  QUOTES_HOME_LOADING_COPY,
} from './quoteHomeSharedPresentation'

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
